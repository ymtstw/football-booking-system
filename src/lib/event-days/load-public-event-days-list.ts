/**
 * GET /api/event-days と同一の一覧ペイロード（公開カレンダー・開催確認ハブ用のサーバー取得）
 * 生データ（開催日・残数・件数）は 60 秒キャッシュ（`getPublicEventDaysRawCached`）。
 * 受付可否など時刻依存の値はここで `Date.now()` から都度算出する。
 */
import { getPublicEventDaysRawCached } from "@/lib/event-days/public-reserve-cache";

export type LoadPublicEventDaysResult =
  | { ok: true; eventDays: unknown[] }
  | { ok: false; message: string; code?: string };

export async function loadPublicEventDaysList(): Promise<LoadPublicEventDaysResult> {
  const raw = await getPublicEventDaysRawCached();
  if (!raw.ok) {
    return { ok: false, message: raw.message, code: raw.code };
  }

  const now = Date.now();
  const { rows, vacancyByEventDayId, activeCountByEventDayId } = raw.data;

  const eventDays = rows.map((row) => {
    const t = new Date(row.reservation_deadline_at).getTime();
    const acceptingReservations =
      row.status === "open" && Number.isFinite(t) && t > now;
    return {
      ...row,
      matchingProposalNoticeSentAt: row.matching_proposal_notice_sent_at ?? null,
      acceptingReservations,
      morningRemainingVacancies: acceptingReservations
        ? (vacancyByEventDayId[row.id] ?? 0)
        : null,
      activeReservationCount: activeCountByEventDayId[row.id] ?? 0,
    };
  });

  return { ok: true, eventDays };
}
