/**
 * 予約サイト・案内メール本文の時刻表記（`vercel.json` の UTC と整合）。
 * - マッチング案内 Cron: UTC `0 7` → 16:00 JST → 利用者向け「17:00まで」
 * - 前日最終 Cron: UTC `30 7` → 16:30 JST → 利用者向け「17:30まで」
 */
export const RESERVE_MAIL_PUBLIC_JA = {
  matchingCronHint: "16:00頃",
  matchingBy: "17:00",
  dayBeforeCronHint: "16:30頃",
  dayBeforeBy: "17:30",
} as const;

/** 予約者向けに共通で付ける注記（ピッタリ時刻の保証はしない） */
export const RESERVE_MAIL_TIMING_NOTE_JA =
  "※送信処理の開始時刻やメールの到着時刻は前後する場合があります。";

/**
 * 予約内容の変更・Web からのキャンセルが可能な締切（開催日基準）。
 * DB の `reservation_deadline_at` と整合。メール・各画面で表記を揃える。
 */
export const RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA =
  "開催日の2日前 15:00（日本時間）";

/** 一文での説明（画面用） */
export const RESERVATION_CHANGE_CANCEL_DEADLINE_SENTENCE_JA = `予約内容の変更・キャンセルは、${RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}まで、このサイトの「予約の確認・キャンセル」からお手続きいただけます。この日時を過ぎると、Web からの変更・キャンセルはできません。`;
