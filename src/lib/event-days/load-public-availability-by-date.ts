/**
 * 予約フォーム（指定日）で使う公開 availability のみ（試合スケジュールは不要）
 */
import {
  buildPublicAvailabilityPayloadForDay,
  type PublicAvailabilityDayRow,
  type PublicAvailabilityPayload,
} from "@/lib/event-days/public-availability-for-day";
import { publicEventDayStatuses } from "@/lib/event-days/public-schedule-for-day";
import { createServiceRoleClient } from "@/lib/supabase/service";

const NOT_FOUND_JA = "開催日が見つからないか、予約画面では表示していません";

export type LoadPublicAvailabilityResult =
  | { ok: true; payload: PublicAvailabilityPayload }
  | { ok: false; error: string; notFound?: boolean };

export async function loadPublicAvailabilityByEventDate(
  eventDate: string
): Promise<LoadPublicAvailabilityResult> {
  const supabase = createServiceRoleClient();
  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .eq("event_date", eventDate)
    .in("status", [...publicEventDayStatuses()])
    .maybeSingle();

  if (dayErr) {
    return { ok: false, error: dayErr.message };
  }
  if (!day) {
    return { ok: false, error: NOT_FOUND_JA, notFound: true };
  }

  const built = await buildPublicAvailabilityPayloadForDay(
    supabase,
    day as PublicAvailabilityDayRow
  );
  if (!built.ok) {
    return { ok: false, error: built.message };
  }
  return { ok: true, payload: built.payload };
}
