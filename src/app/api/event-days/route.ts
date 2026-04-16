/**
 * 公開 GET: 一般カレンダーに載せる開催日（中止系を含む公開可能ステータス）。
 * 予約受付可能かは acceptingReservations（status が open かつ締切が未来）。
 * 仕様: docs/spec/reservation-deadline-and-event-status.md
 */
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * 公開用: 下書き以外の主要ステータスを返す。個人情報・notes は含めない。
 */
export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .in("status", [
      "open",
      "locked",
      "confirmed",
      "cancelled_weather",
      "cancelled_operational",
      "cancelled_minimum",
    ])
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  const now = Date.now();
  const rows = data ?? [];
  const eventDays = rows.map((row) => {
    const t = new Date(row.reservation_deadline_at).getTime();
    const acceptingReservations =
      row.status === "open" && Number.isFinite(t) && t > now;
    return { ...row, acceptingReservations };
  });

  return NextResponse.json({ eventDays });
}
