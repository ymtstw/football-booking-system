/**
 * 昼食フォームの数量欄: 空白は 0 件。数字がある場合は 0〜500 の整数のみ有効。
 */
export function parseLunchQuantityField(
  raw: string | undefined
): { ok: true; quantity: number } | { ok: false } {
  const t = (raw ?? "").trim();
  if (t === "") return { ok: true, quantity: 0 };
  const q = parseInt(t, 10);
  if (!Number.isInteger(q) || q < 0 || q > 500) return { ok: false };
  return { ok: true, quantity: q };
}
