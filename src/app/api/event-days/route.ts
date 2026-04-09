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

  return NextResponse.json({ eventDays: data ?? [] });
}
