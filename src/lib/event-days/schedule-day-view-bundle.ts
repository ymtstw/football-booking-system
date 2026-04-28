/**
 * 開催確認・試合予定（日別）画面用: event_days を1回だけ取得し、availability / public-schedule を並列構築
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

import {
  buildPublicAvailabilityPayloadForDay,
  type PublicAvailabilityDayRow,
  type PublicAvailabilityPayload,
} from "./public-availability-for-day";
import {
  buildPublicSchedulePayloadForDay,
  publicEventDayStatuses,
  type PublicSchedulePayload,
} from "./public-schedule-for-day";

const AVAILABILITY_NOT_FOUND_JA =
  "開催日が見つからないか、予約画面では表示していません";

export type ScheduleDayViewBundle = {
  availability: PublicAvailabilityPayload | null;
  availabilityError: string | null;
  schedule: PublicSchedulePayload | null;
  scheduleError: string | null;
};

export async function loadScheduleDayViewBundle(eventDate: string): Promise<ScheduleDayViewBundle> {
  const supabase = createServiceRoleClient();

  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at, matching_proposal_notice_sent_at")
    .eq("event_date", eventDate)
    .in("status", [...publicEventDayStatuses()])
    .maybeSingle();

  if (dayErr) {
    return {
      availability: null,
      availabilityError: dayErr.message,
      schedule: null,
      scheduleError: dayErr.message,
    };
  }

  if (!day) {
    return {
      availability: null,
      availabilityError: AVAILABILITY_NOT_FOUND_JA,
      schedule: null,
      scheduleError: null,
    };
  }

  const row = day as PublicAvailabilityDayRow;

  const [av, sc] = await Promise.all([
    buildPublicAvailabilityPayloadForDay(supabase, row),
    buildPublicSchedulePayloadForDay(supabase, row),
  ]);

  return {
    availability: av.ok ? av.payload : null,
    availabilityError: av.ok ? null : av.message,
    schedule: sc.ok ? sc.payload : null,
    scheduleError: sc.ok ? null : sc.message,
  };
}
