/**
 * 昼食フォームの数量欄: 空白は 0 件。数字がある場合は半角・最大3桁・0〜500 の整数のみ有効（DB/RPC と一致）。
 */
export const LUNCH_MENU_QTY_MAX = 500;
export const LUNCH_MENU_QTY_MAX_DIGITS = 3;

/** 昼食数フィールドの入力エラー用（メニュー単位・空欄可） */
export const LUNCH_MENU_QTY_PARSE_HELP_JA =
  "0〜500 の半角数字（最大3桁）で入力してください。不要なメニューは空白のままで構いません。";

export function parseLunchQuantityField(
  raw: string | undefined
): { ok: true; quantity: number } | { ok: false } {
  const t = (raw ?? "").trim();
  if (t === "") return { ok: true, quantity: 0 };
  if (t.length > LUNCH_MENU_QTY_MAX_DIGITS) return { ok: false };
  const q = parseInt(t, 10);
  if (!Number.isInteger(q) || q < 0 || q > LUNCH_MENU_QTY_MAX) return { ok: false };
  return { ok: true, quantity: q };
}
