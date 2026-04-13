/**
 * 公開 GET: status=open の開催日のみ。各行に acceptingReservations（締切が未来か）。
 * 締切後も status が open の間は行が返り得るが、予約可否は締切で判定。仕様: docs/spec/reservation-deadline-and-event-status.md
 */
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * 公開用: status = open の開催日のみ。個人情報・notes は含めない。
 */
export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .eq("status", "open")
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
    const acceptingReservations = Number.isFinite(t) && t > now;
    return { ...row, acceptingReservations };
  });

  return NextResponse.json({ eventDays });
}
