/** event_days.status を管理画面用の短い日本語に。 */
export function eventDayStatusLabelJa(status: string): string {
  switch (status) {
    case "draft":
      return "公開前";
    case "open":
      return "公開済み";
    case "locked":
      return "締切済み";
    case "confirmed":
      return "確定";
    case "cancelled_weather":
      return "雨天中止";
    case "cancelled_minimum":
      return "最少未達中止";
    case "cancelled_operational":
      return "運営中止";
    default:
      return status;
  }
}
