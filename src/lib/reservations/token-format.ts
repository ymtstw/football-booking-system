/** 予約 token の形式・正規化・照会保持期限（ブラウザでも利用可・crypto なし）。 */

import { isValidReservationConfirmationRaw } from "@/lib/reservations/confirmation-code";

/** 照合・URL 用: 旧 64 hex は小文字へ。新短コードはハイフン・空白除去し大文字へ。 */
export function normalizeReservationTokenPlain(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return "";

  const noSpaceHyphen = trimmed.replace(/[\s-]/g, "");
  const lower = noSpaceHyphen.toLowerCase();
  if (/^[0-9a-f]{64}$/.test(lower)) {
    return lower;
  }

  return noSpaceHyphen.toUpperCase();
}

/**
 * 旧: 32 バイト hex = 64 文字。
 * 新: 16 文字・CONFIRMATION_CODE_ALPHABET のみ。
 */
export function isValidReservationTokenFormat(token: string): boolean {
  if (/^[0-9a-f]{64}$/.test(token)) return true;
  return isValidReservationConfirmationRaw(token);
}

function parseYmdUtc(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
}

/** 東京の暦日 YYYY-MM-DD */
export function todayInTokyoYyyyMmDd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 設計 §8-3: 開催日から 30 日を超えた暦日なら照会不可（404 と同扱い）。
 * （開催日当日を 0 日目とし、差が 30 超なら期限切れ）
 */
export function isReservationLookupExpired(eventDateYyyyMmDd: string): boolean {
  const eventMs = parseYmdUtc(eventDateYyyyMmDd);
  const todayMs = parseYmdUtc(todayInTokyoYyyyMmDd());
  if (Number.isNaN(eventMs) || Number.isNaN(todayMs)) return true;
  const diffDays = (todayMs - eventMs) / 86_400_000;
  return diffDays > 30;
}
