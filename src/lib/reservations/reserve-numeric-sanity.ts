/**
 * 公開予約の参加人数・昼食食数の誤入力ガード。
 * 「4桁以上」（1000以上）は受け付けず、UI は alert、API は 422 で拒否する。
 */

export const RESERVE_COUNT_REJECT_FROM = 1000;

/** 画面上・エラーメッセージ用（999 以下） */
export const RESERVE_COUNT_MAX_ALLOWED = RESERVE_COUNT_REJECT_FROM - 1;

export function isAtLeastFourDigitCount(n: number): boolean {
  return Number.isInteger(n) && n >= RESERVE_COUNT_REJECT_FROM;
}
