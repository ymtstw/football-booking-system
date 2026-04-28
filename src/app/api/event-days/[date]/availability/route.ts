/**
 * 公開 GET: 指定日の開催日（open / locked / confirmed / 中止系）について、午前各枠の集計。認証不要。
 * 新規予約は status=open かつ締切前のみ（仕様: docs/spec/implemented-behavior-catalog.md §1）。
 */
import { NextResponse } from "next/server";

import {
  buildPublicAvailabilityPayloadForDay,
  type PublicAvailabilityDayRow,
} from "@/lib/event-days/public-availability-for-day";
import { publicEventDayStatuses } from "@/lib/event-days/public-schedule-for-day";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { createServiceRoleClient } from "@/lib/supabase/service";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> }
) {
  const { date: dateParam } = await context.params;
  const eventDate = decodeURIComponent(dateParam ?? "").trim();

  if (!eventDate || !isIsoDateOnly(eventDate)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD で指定してください" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .eq("event_date", eventDate)
    .in("status", [...publicEventDayStatuses()])
    .maybeSingle();

  if (dayErr) {
    logPublicReserveApiSupabaseError(
      `GET /api/event-days/${eventDate}/availability event_days`,
      dayErr
    );
    return NextResponse.json({ error: PUBLIC_RESERVE_API_READ_ERROR_JA }, { status: 500 });
  }

  if (!day) {
    return NextResponse.json(
      { error: "開催日が見つからないか、予約画面では表示していません" },
      { status: 404 }
    );
  }

  const built = await buildPublicAvailabilityPayloadForDay(
    supabase,
    day as PublicAvailabilityDayRow
  );
  if (!built.ok) {
    return NextResponse.json({ error: built.message }, { status: 500 });
  }

  return NextResponse.json(built.payload);
}
