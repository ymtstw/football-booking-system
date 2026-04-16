import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIMPLE_EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Strength = "strong" | "potential";

function isStrength(s: string): s is Strength {
  return s === "strong" || s === "potential";
}

/** 管理: 予約に紐づくチーム連絡先・人数・備考のみ更新（枠・試合の変更は別導線） */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID が不正です" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const participantCountRaw = b.participant_count;

  const teamRaw = b.team;
  if (teamRaw !== undefined && teamRaw !== null && typeof teamRaw !== "object") {
    return NextResponse.json({ error: "team はオブジェクトで指定してください" }, { status: 422 });
  }
  const team = teamRaw as Record<string, unknown> | null | undefined;

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchErr } = await supabase
    .from("reservations")
    .select("id, team_id, participant_count, remarks, display_name")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "予約が見つかりません" },
      { status: fetchErr ? 500 : 404 }
    );
  }

  const teamId = row.team_id as string;

  const reservationPatch: Record<string, unknown> = {};
  if ("participant_count" in b) {
    const n =
      typeof participantCountRaw === "number"
        ? participantCountRaw
        : typeof participantCountRaw === "string" && String(participantCountRaw).trim() !== ""
          ? Number(String(participantCountRaw).trim())
          : NaN;
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json(
        { error: "参加人数は 1 以上の整数で指定してください" },
        { status: 422 }
      );
    }
    reservationPatch.participant_count = n;
  }
  if ("remarks" in b) {
    if (b.remarks !== null && typeof b.remarks !== "string") {
      return NextResponse.json({ error: "remarks は文字列または null です" }, { status: 422 });
    }
    const remarks = typeof b.remarks === "string" ? b.remarks : null;
    if (remarks !== null && remarks.length > 2000) {
      return NextResponse.json(
        { error: "備考は 2000 文字以内で指定してください" },
        { status: 422 }
      );
    }
    reservationPatch.remarks = remarks;
  }
  if ("display_name" in b) {
    if (b.display_name !== null && typeof b.display_name !== "string") {
      return NextResponse.json(
        { error: "display_name は文字列または null です" },
        { status: 422 }
      );
    }
    const displayName =
      typeof b.display_name === "string" ? b.display_name.trim() : null;
    if (displayName !== null && displayName.length > 120) {
      return NextResponse.json(
        { error: "表示名は 120 文字以内で指定してください" },
        { status: 422 }
      );
    }
    reservationPatch.display_name = displayName === "" || displayName === null ? null : displayName;
  }

  const teamPatch: Record<string, unknown> = {};
  if (team && typeof team === "object") {
    if (typeof team.team_name === "string") {
      const s = team.team_name.trim();
      if (s === "") {
        return NextResponse.json({ error: "チーム名は空にできません" }, { status: 422 });
      }
      if (s.length > 120) {
        return NextResponse.json(
          { error: "チーム名は 120 文字以内で指定してください" },
          { status: 422 }
        );
      }
      teamPatch.team_name = s;
    }
    if (typeof team.contact_name === "string") {
      const s = team.contact_name.trim();
      if (s === "") {
        return NextResponse.json({ error: "代表者名は空にできません" }, { status: 422 });
      }
      if (s.length > 80) {
        return NextResponse.json(
          { error: "代表者名は 80 文字以内で指定してください" },
          { status: 422 }
        );
      }
      teamPatch.contact_name = s;
    }
    if (typeof team.contact_email === "string") {
      const s = team.contact_email.trim();
      if (s === "" || !SIMPLE_EMAIL_RE.test(s)) {
        return NextResponse.json(
          { error: "メールアドレスの形式が不正です" },
          { status: 422 }
        );
      }
      if (s.length > 254) {
        return NextResponse.json(
          { error: "メールアドレスが長すぎます" },
          { status: 422 }
        );
      }
      teamPatch.contact_email = s;
    }
    if (typeof team.contact_phone === "string") {
      const s = team.contact_phone.trim();
      if (s === "") {
        return NextResponse.json({ error: "電話番号は空にできません" }, { status: 422 });
      }
      if (s.length > 30) {
        return NextResponse.json(
          { error: "電話番号は 30 文字以内で指定してください" },
          { status: 422 }
        );
      }
      teamPatch.contact_phone = s;
    }
    if (typeof team.strength_category === "string") {
      if (!isStrength(team.strength_category)) {
        return NextResponse.json(
          { error: "強さ区分は strong または potential です" },
          { status: 422 }
        );
      }
      teamPatch.strength_category = team.strength_category;
    }
    if (team.representative_grade_year !== undefined) {
      if (team.representative_grade_year === null) {
        teamPatch.representative_grade_year = null;
      } else {
        const gy =
          typeof team.representative_grade_year === "number"
            ? team.representative_grade_year
            : typeof team.representative_grade_year === "string" &&
                team.representative_grade_year.trim() !== ""
              ? Number(team.representative_grade_year.trim())
              : NaN;
        if (!Number.isInteger(gy) || gy < 1 || gy > 6) {
          return NextResponse.json(
            { error: "代表学年は 1〜6 の整数、または null です" },
            { status: 422 }
          );
        }
        teamPatch.representative_grade_year = gy;
      }
    }
  }

  if (Object.keys(teamPatch).length > 0) {
    const { error: teamErr } = await supabase
      .from("teams")
      .update(teamPatch)
      .eq("id", teamId);
    if (teamErr) {
      return NextResponse.json(
        { error: teamErr.message ?? "チーム情報の更新に失敗しました" },
        { status: 500 }
      );
    }
  }

  if (Object.keys(reservationPatch).length > 0) {
    const { error: resErr } = await supabase
      .from("reservations")
      .update(reservationPatch)
      .eq("id", id);
    if (resErr) {
      return NextResponse.json(
        { error: resErr.message ?? "予約の更新に失敗しました" },
        { status: 500 }
      );
    }
  }

  if (Object.keys(teamPatch).length === 0 && Object.keys(reservationPatch).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
