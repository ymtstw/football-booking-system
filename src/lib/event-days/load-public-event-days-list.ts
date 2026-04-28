/**
 * GET /api/event-days と同一の一覧ペイロード（公開カレンダー・開催確認ハブ用のサーバー取得）
 */
import { sumMorningRemainingVacanciesByEventDay } from "@/lib/event-days/morning-remaining-vacancies";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type LoadPublicEventDaysResult =
  | { ok: true; eventDays: unknown[] }
  | { ok: false; message: string; code?: string };

export async function loadPublicEventDaysList(): Promise<LoadPublicEventDaysResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, reservation_deadline_at, matching_proposal_notice_sent_at"
    )
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
    logPublicReserveApiSupabaseError("loadPublicEventDaysList event_days", error);
    return { ok: false, message: PUBLIC_RESERVE_API_READ_ERROR_JA, code: error.code };
  }

  const now = Date.now();
  const rows = data ?? [];
  const eventDayIds = rows.map((r) => String(r.id));
  const vacancyMap = await sumMorningRemainingVacanciesByEventDay(supabase, eventDayIds);

  const activeCountByEventDayId = new Map<string, number>();
  if (eventDayIds.length > 0) {
    const { data: resCountRows, error: resCountErr } = await supabase
      .from("reservations")
      .select("event_day_id")
      .in("event_day_id", eventDayIds)
      .eq("status", "active");
    if (!resCountErr && Array.isArray(resCountRows)) {
      for (const r of resCountRows) {
        const id = String((r as { event_day_id: string }).event_day_id);
        activeCountByEventDayId.set(id, (activeCountByEventDayId.get(id) ?? 0) + 1);
      }
    }
  }

  const eventDays = rows.map((row) => {
    const t = new Date(row.reservation_deadline_at).getTime();
    const acceptingReservations =
      row.status === "open" && Number.isFinite(t) && t > now;
    return {
      ...row,
      matchingProposalNoticeSentAt:
        (row as { matching_proposal_notice_sent_at?: string | null })
          .matching_proposal_notice_sent_at ?? null,
      acceptingReservations,
      morningRemainingVacancies: acceptingReservations
        ? (vacancyMap.get(String(row.id)) ?? 0)
        : null,
      activeReservationCount: activeCountByEventDayId.get(String(row.id)) ?? 0,
    };
  });

  return { ok: true, eventDays };
}
