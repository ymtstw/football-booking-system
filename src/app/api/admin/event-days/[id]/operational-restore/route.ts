/**
 * 運営都合中止の取り消し。締切ロック前（中止時点が open / locked）のみ可。
 * 確定（confirmed）後に中止した場合は取り消せない。
 */
import { NextResponse } from "next/server";

import {
  ADMIN_API_READ_ERROR_JA,
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { assertEventDayAcceptsBookableLunchMenus } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventDayId } = await context.params;
  if (!eventDayId) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: ed, error: fetchErr } = await supabase
    .from("event_days")
    .select("id, status, status_before_operational_cancel")
    .eq("id", eventDayId)
    .maybeSingle();

  if (fetchErr) {
    logAdminApiDbError("POST operational-restore fetch event_days", fetchErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!ed) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  if ((ed.status as string) !== "cancelled_operational") {
    return NextResponse.json(
      { error: "運営都合中止の開催日だけ取り消せます" },
      { status: 409 }
    );
  }

  const prev = ed.status_before_operational_cancel as string | null;
  if (prev === "confirmed") {
    return NextResponse.json(
      { error: "編成確定後に運営中止したため、ここからは取り消せません" },
      { status: 409 }
    );
  }

  const nextStatus =
    prev === "open" || prev === "locked" ? prev : prev === null ? "confirmed" : null;
  if (!nextStatus) {
    return NextResponse.json(
      { error: "取り消し先の状態が不明です（履歴がない可能性があります）" },
      { status: 409 }
    );
  }

  if (nextStatus === "open") {
    const lunch = await assertEventDayAcceptsBookableLunchMenus(supabase, eventDayId);
    if (!lunch.ok) {
      return NextResponse.json({ error: lunch.message }, { status: 422 });
    }
  }

  const { error: upErr } = await supabase
    .from("event_days")
    .update({
      status: nextStatus,
      operational_cancellation_notice: null,
      status_before_operational_cancel: null,
    })
    .eq("id", eventDayId)
    .eq("status", "cancelled_operational");

  if (upErr) {
    logAdminApiDbError("POST operational-restore update event_days", upErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventDayId, restoredStatus: nextStatus });
}
