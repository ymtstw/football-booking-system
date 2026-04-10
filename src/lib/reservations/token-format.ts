/** 予約 token の形式・正規化・照会保持期限（ブラウザでも利用可・crypto なし）。 */

/** 照合・URL 用: 前後空白除去し hex は小文字に統一 */
export function normalizeReservationTokenPlain(plain: string): string {
  return plain.trim().toLowerCase();
}

/** 平文 token は 32 バイト hex = 64 文字（小文字想定・normalize 後に検証） */
export function isValidReservationTokenFormat(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
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
