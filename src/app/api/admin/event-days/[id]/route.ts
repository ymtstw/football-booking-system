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
