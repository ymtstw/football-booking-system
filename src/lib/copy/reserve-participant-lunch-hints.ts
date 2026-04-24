/**
 * 予約フォームの「参加人数」「昼食」直下の補足文言。
 * UI 上は参加人数＝試合に出る選手数、昼食数＝事前申込する昼食の食数（施設カフェ利用分は含めない）として案内する。
 */

/** 参加人数フィールド直下 */
export const RESERVE_PARTICIPANT_COUNT_HINT_JA =
  "試合に参加する選手数を入力してください。スタッフ・保護者・引率者は含めません。";

/** 昼食ブロック見出し直下（複数行表示用） */
export const RESERVE_LUNCH_ORDER_HELP_LINES_JA = [
  "昼食をご希望の場合は、注文する人数分をご入力ください。",
  "選手分は事前申込、保護者の方は施設カフェ利用がおすすめです。",
  "施設カフェを利用する人数は、昼食数に含めないでください。",
] as const;

/** 管理画面など1段落で表示する場合 */
export const RESERVE_LUNCH_ORDER_HELP_JA =
  RESERVE_LUNCH_ORDER_HELP_LINES_JA.join(" ");
