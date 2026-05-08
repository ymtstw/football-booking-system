/** ダッシュボード開催日カード用（サーバー／クライアント共通） */

export function weatherSummaryJa(status: string, weatherStatus: string | null): string {
  if (status === "cancelled_weather") return "中止（天候）";
  if (status === "cancelled_operational") return "中止（運営）";
  if (status === "cancelled_minimum") return "中止（最少催行）";
  const w = weatherStatus?.trim();
  if (!w) return "天候未判断";
  if (w === "go") return "開催予定";
  if (w === "cancel") return "中止予定";
  return `天候メモ: ${w}`;
}

export function preDayConfirmedJa(dayStatus: string): string {
  if (dayStatus === "confirmed") return "済";
  if (dayStatus === "locked") return "未（編成待ち）";
  return "未";
}
