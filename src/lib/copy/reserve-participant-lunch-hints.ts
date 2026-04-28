/**
 * 予約フォームの「参加人数」「昼食」直下の補足文言。
 */

/** 参加人数フィールド直下 */
export const RESERVE_PARTICIPANT_COUNT_HINT_JA =
  "試合に参加する選手数を入力してください。";

/** 昼食ブロック見出し直下（2段落・段落間は各 `<p>`＋親の `space-y` で確保） */
export const RESERVE_LUNCH_ORDER_HELP_LINES_JA = [
  "昼食を希望する人数分の数量を入力してください。※施設カフェ利用者は含めません。",
  "選手分は事前申し込み、保護者の方は施設カフェがおすすめです。",
] as const;

/** メール等・1段落に畳む場合（改行なし） */
export const RESERVE_LUNCH_ORDER_HELP_JA =
  RESERVE_LUNCH_ORDER_HELP_LINES_JA.join(" ");
