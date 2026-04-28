/**
 * 公開予約の参加人数・昼食食数の誤入力ガード。
 * 5桁以上（10000以上）は受け付けず、UI は alert、API は 422 で拒否する。
 */

export const RESERVE_COUNT_REJECT_FROM = 10000;

/** 画面上・エラーメッセージ用（9999 以下） */
export const RESERVE_COUNT_MAX_ALLOWED = RESERVE_COUNT_REJECT_FROM - 1;

/** 参加人数・昼食合計などが許容上限を超える誤入力か */
export function exceedsReserveCountMaxAllowed(n: number): boolean {
  return Number.isInteger(n) && n > RESERVE_COUNT_MAX_ALLOWED;
}
