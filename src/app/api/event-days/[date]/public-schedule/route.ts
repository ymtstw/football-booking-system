/**
 * 公開 GET: 開催日が「確定（confirmed）」のときのみ、現在の matching_run の試合割当を
 * チーム名・枠時刻など閲覧用に返す。連絡先は含めない。認証不要。
 * open / locked 等では confirmedMatches は null（午前状況は /availability を利用）。
 */
import { NextResponse } from "next/server";

import type { PublicAvailabilityDayRow } from "@/lib/event-days/public-availability-for-day";
import {
  buildPublicSchedulePayloadForDay,
  publicEventDayStatuses,
} from "@/lib/event-days/public-schedule-for-day";
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
    .select("id, event_date, grade_band, status, reservation_deadline_at, matching_proposal_notice_sent_at")
    .eq("event_date", eventDate)
    .in("status", [...publicEventDayStatuses()])
    .maybeSingle();

  if (dayErr) {
    logPublicReserveApiSupabaseError(
      `GET /api/event-days/${eventDate}/public-schedule event_days`,
      dayErr
    );
    return NextResponse.json({ error: PUBLIC_RESERVE_API_READ_ERROR_JA }, { status: 500 });
  }

  if (!day) {
    return NextResponse.json(
      { error: "開催日が見つからないか、公開されていません" },
      { status: 404 }
    );
  }

  const built = await buildPublicSchedulePayloadForDay(supabase, day as PublicAvailabilityDayRow);
  if (!built.ok) {
    return NextResponse.json({ error: built.message }, { status: 500 });
  }

  return NextResponse.json(built.payload);
}
