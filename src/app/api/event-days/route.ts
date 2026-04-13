/** 公開 GET: status=open の開催日のみ。個人情報・notes は返さない。 */
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
