/** ダッシュボード開催日カード用（サーバー／クライアント共通） */

export function weatherSummaryJa(status: string, weatherStatus: string | null): string {
  if (status === "cancelled_weather") return "中止（天候）";
  if (status === "cancelled_minimum") return "中止（最少催行）";
  const w = weatherStatus?.trim();
  if (w) return `雨天メモ: ${w}`;
  return "雨天メモ未設定";
}

export function preDayConfirmedJa(dayStatus: string): string {
  if (dayStatus === "confirmed") return "済";
  if (dayStatus === "locked") return "未（締切後・編成まち）";
  return "未";
}
