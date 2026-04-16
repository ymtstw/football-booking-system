import { addDaysIsoDate } from "@/lib/dates/tokyo-calendar-grid";

/**
 * 運用既定: 開催日の **2 日前 15:00（Asia/Tokyo）** を予約締切とする（`timestamptz` 用 ISO 文字列）。
 */
export function defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst(
  eventDateIso: string
): string {
  const day = addDaysIsoDate(eventDateIso, -2);
  return `${day}T15:00:00+09:00`;
}
