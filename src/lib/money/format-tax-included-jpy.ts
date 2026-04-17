/** ユーザー向け: 税込価格の表示（円・整数） */
export function formatTaxIncludedYen(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  return `¥${Math.round(amount).toLocaleString("ja-JP")}（税込）`;
}
