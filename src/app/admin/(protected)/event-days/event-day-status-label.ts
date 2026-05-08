/** event_days.status を管理画面用の短い日本語に。 */
export function eventDayStatusLabelJa(
  status: string,
  opts?: { finalDayBeforeNoticeCompletedAt?: string | null }
): string {
  switch (status) {
    case "draft":
      return "公開前";
    case "open":
      return "公開中";
    case "locked":
      return "受付終了";
    case "confirmed":
      return opts?.finalDayBeforeNoticeCompletedAt ? "開催確定" : "試合スケジュール確定";
    case "cancelled_weather":
      return "天候により中止";
    case "cancelled_minimum":
      return "最少催行未達で中止";
    case "cancelled_operational":
      return "運営都合で中止";
    default:
      return "要確認";
  }
}
