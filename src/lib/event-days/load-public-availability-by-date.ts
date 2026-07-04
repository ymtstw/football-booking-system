/**
 * 予約フォーム（指定日）で使う公開 availability のみ（試合スケジュールは不要）
 * 生成結果は 30 秒キャッシュ（`getPublicAvailabilityCached`）。受付可否・bookable は都度上書き。
 */
import type { PublicAvailabilityPayload } from "@/lib/event-days/public-availability-for-day";
import {
  deriveFreshAvailabilityAcceptance,
  getPublicAvailabilityCached,
} from "@/lib/event-days/public-reserve-cache";

const NOT_FOUND_JA = "開催日が見つからないか、予約画面では表示していません";

export type LoadPublicAvailabilityResult =
  | { ok: true; payload: PublicAvailabilityPayload }
  | { ok: false; error: string; notFound?: boolean };

export async function loadPublicAvailabilityByEventDate(
  eventDate: string
): Promise<LoadPublicAvailabilityResult> {
  const cached = await getPublicAvailabilityCached(eventDate);
  if (!cached.ok) {
    if (cached.kind === "not_found") {
      return { ok: false, error: NOT_FOUND_JA, notFound: true };
    }
    return { ok: false, error: cached.message };
  }
  return { ok: true, payload: deriveFreshAvailabilityAcceptance(cached.payload) };
}
