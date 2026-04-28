import { NextResponse } from "next/server";

import {
  ADMIN_API_GENERIC_ERROR_JA,
  ADMIN_API_READ_ERROR_JA,
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { getAdminUser } from "@/lib/auth/require-admin";
import { sendReservationCreatedEmailAndUpdateNotification } from "@/lib/email/reservation-created-mail";
import {
  formatReservationConfirmationDisplay,
  generateReservationConfirmationRaw,
} from "@/lib/reservations/confirmation-code";
import { hashReservationTokenPlain } from "@/lib/reservations/reservation-token-hash";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIMPLE_EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TeamEmbed = {
  team_name: string;
  contact_name: string;
  representative_grade_year: number | null;
};

function singleTeam(
  x: TeamEmbed | TeamEmbed[] | null | undefined
): TeamEmbed | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

/** 管理: 予約完了メールを任意の宛先へ再送（確認コードは再発行し、従来のコードは無効化） */
export async function POST(
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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    return NextResponse.json(
      {
        error:
          "メール送信環境（RESEND_API_KEY / RESEND_FROM）が未設定のため送信できません",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const toEmailRaw =
    typeof b.toEmail === "string" ? b.toEmail.trim() : typeof b.email === "string"
      ? b.email.trim()
      : "";
  if (!toEmailRaw || !SIMPLE_EMAIL_RE.test(toEmailRaw)) {
    return NextResponse.json(
      { error: "送信先メールアドレスの形式が不正です" },
      { status: 422 }
    );
  }
  if (toEmailRaw.length > 254) {
    return NextResponse.json(
      { error: "メールアドレスが長すぎます" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchErr } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      event_day_id,
      reservation_token_hash,
      public_ref,
      teams (
        team_name,
        contact_name,
        representative_grade_year
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    logAdminApiDbError("POST resend-created-email fetch reservation", fetchErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const status = String((row as { status: string }).status);
  if (status !== "active") {
    return NextResponse.json(
      { error: "有効な予約のみ再送できます（取消済みは不可）" },
      { status: 409 }
    );
  }

  const team = singleTeam(
    (row as { teams: TeamEmbed | TeamEmbed[] | null }).teams
  );
  if (!team) {
    return NextResponse.json({ error: "チーム情報が見つかりません" }, { status: 500 });
  }

  const gy = team.representative_grade_year;
  if (
    gy == null ||
    !Number.isInteger(gy) ||
    gy < 1 ||
    gy > 6
  ) {
    return NextResponse.json(
      {
        error:
          "代表学年が未設定または不正なため送信できません。先にチーム情報で代表学年（1〜6）を保存してください。",
      },
      { status: 422 }
    );
  }

  const eventDayId = String((row as { event_day_id: string }).event_day_id);
  const { data: dayRow, error: dayErr } = await supabase
    .from("event_days")
    .select("event_date, grade_band")
    .eq("id", eventDayId)
    .maybeSingle();

  if (dayErr) {
    logAdminApiDbError(
      "POST resend-created-email event_days lookup",
      dayErr
    );
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!dayRow) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const oldHash = String(
    (row as { reservation_token_hash: string }).reservation_token_hash
  );
  const publicRef = String(
    (row as { public_ref?: string | null }).public_ref ?? ""
  ).trim();
  if (!publicRef) {
    return NextResponse.json(
      { error: "予約番号（public_ref）が未設定です。DB マイグレーションを適用してください。" },
      { status: 500 }
    );
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const tokenPlain = generateReservationConfirmationRaw();
    const tokenDisplay = formatReservationConfirmationDisplay(tokenPlain);
    const tokenHash = hashReservationTokenPlain(tokenPlain);

    const { error: updErr } = await supabase
      .from("reservations")
      .update({ reservation_token_hash: tokenHash })
      .eq("id", id);

    if (updErr?.code === "23505") {
      continue;
    }
    if (updErr) {
      logAdminApiDbError(
        "POST resend-created-email reservations token hash update",
        updErr
      );
      return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
    }

    const { data: notif, error: insErr } = await supabase
      .from("notifications")
      .insert({
        event_day_id: eventDayId,
        reservation_id: id,
        channel: "email",
        status: "pending",
        template_key: "reservation_created",
        payload_summary: { reservation_id: id },
      })
      .select("id")
      .maybeSingle();

    if (insErr || !notif?.id) {
      if (insErr) {
        logAdminApiDbError("POST resend-created-email notifications insert", insErr);
      } else {
        console.error("[admin-api] POST resend-created-email notifications insert missing id");
      }
      await supabase
        .from("reservations")
        .update({ reservation_token_hash: oldHash })
        .eq("id", id);
      return NextResponse.json(
        { error: ADMIN_API_GENERIC_ERROR_JA },
        { status: 500 }
      );
    }

    await sendReservationCreatedEmailAndUpdateNotification({
      supabase,
      reservationId: id,
      to: toEmailRaw,
      contactName: team.contact_name.trim(),
      teamName: team.team_name.trim(),
      eventDateIso: (dayRow as { event_date: string }).event_date ?? null,
      gradeBand: (dayRow as { grade_band: string }).grade_band ?? null,
      representativeGradeYear: gy,
      reservationTokenPlain: tokenPlain,
      reservationTokenDisplay: tokenDisplay,
      publicRef,
      notificationId: notif.id,
      deliveryTrigger: "admin_resend",
    });

    return NextResponse.json({
      ok: true,
      message:
        "予約完了メールを送信しました。予約番号は変わらず、新しい確認コードがメールに記載され、以前の確認コードは無効になりました。",
    });
  }

  return NextResponse.json(
    { error: "確認コードの生成が続けて競合しました。しばらくしてから再度お試しください" },
    { status: 503 }
  );
}
