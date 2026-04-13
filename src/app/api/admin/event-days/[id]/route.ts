/** 管理者のみ PATCH: draft↔open、または open→locked（締切ロック）。 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const EVENT_DAY_SELECT =
  "id, event_date, grade_band, status, reservation_deadline_at" as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { status?: string };
  const nextStatus = body.status;
  if (nextStatus !== "draft" && nextStatus !== "open" && nextStatus !== "locked") {
    return NextResponse.json(
      { error: "status は draft / open / locked のいずれかです" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchErr } = await supabase
    .from("event_days")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: fetchErr.message, code: fetchErr.code },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const current = row.status as string;

  if (nextStatus === "locked") {
    if (current !== "open") {
      return NextResponse.json(
        { error: "締切ロックは公開中（open）の開催日にのみ行えます" },
        { status: 409 }
      );
    }
    const { data: updated, error: updateErr } = await supabase
      .from("event_days")
      .update({ status: "locked" })
      .eq("id", id)
      .eq("status", "open")
      .select(EVENT_DAY_SELECT)
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message, code: updateErr.code },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { error: "状態が更新されませんでした。一覧を更新して再度お試しください。" },
        { status: 409 }
      );
    }
    return NextResponse.json({ eventDay: updated });
  }

  if (current !== "draft" && current !== "open") {
    return NextResponse.json(
      { error: "この状態からは公開・非公開の切り替えはできません" },
      { status: 409 }
    );
  }

  if (nextStatus === "open" && current !== "draft") {
    return NextResponse.json(
      { error: "公開できるのは公開前（draft）のときだけです" },
      { status: 422 }
    );
  }
  if (nextStatus === "draft" && current !== "open") {
    return NextResponse.json(
      { error: "公開前に戻せるのは公開中（open）のときだけです" },
      { status: 422 }
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("event_days")
    .update({ status: nextStatus })
    .eq("id", id)
    .eq("status", current)
    .select(EVENT_DAY_SELECT)
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message, code: updateErr.code },
      { status: 500 }
    );
  }
  if (!updated) {
    return NextResponse.json(
      { error: "状態が更新されませんでした。一覧を更新して再度お試しください。" },
      { status: 409 }
    );
  }

  return NextResponse.json({ eventDay: updated });
}

/** 管理者のみ DELETE: 公開前（draft）かつ予約ゼロの開催日のみ削除（枠などは CASCADE）。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchErr } = await supabase
    .from("event_days")
    .select("id, status, event_date")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: fetchErr.message, code: fetchErr.code },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  if (row.status !== "draft") {
    return NextResponse.json(
      { error: "公開前の開催日だけ削除できます" },
      { status: 409 }
    );
  }

  const { count: resCount, error: countErr } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("event_day_id", id);

  if (countErr) {
    return NextResponse.json(
      { error: countErr.message, code: countErr.code },
      { status: 500 }
    );
  }
  if (resCount !== null && resCount > 0) {
    return NextResponse.json(
      { error: "この開催日に予約があるため削除できません" },
      { status: 409 }
    );
  }

  const { error: delErr } = await supabase.from("event_days").delete().eq("id", id);

  if (delErr) {
    return NextResponse.json(
      { error: delErr.message, code: delErr.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
