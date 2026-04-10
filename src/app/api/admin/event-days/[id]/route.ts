/** 管理者のみ PATCH: 開催日 status を draft/open に（現在が draft/open のときだけ）。 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

type ToggleStatus = "draft" | "open";

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
  if (nextStatus !== "draft" && nextStatus !== "open") {
    return NextResponse.json(
      { error: "status は draft または open のみです" },
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
  if (current !== "draft" && current !== "open") {
    return NextResponse.json(
      { error: "この状態からは draft/open へ切り替えできません" },
      { status: 409 }
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("event_days")
    .update({ status: nextStatus as ToggleStatus })
    .eq("id", id)
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .single();

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message, code: updateErr.code },
      { status: 500 }
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
