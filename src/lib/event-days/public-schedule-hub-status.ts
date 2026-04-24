/**
 * 公開「開催確認・試合予定」系画面での開催日ステータス表示（DB status + acceptingReservations）。
 */

export type PublicScheduleHubStatusTone = "ok" | "muted" | "bad";

export type PublicScheduleHubStatusInput = {
  status: string;
  acceptingReservations: boolean;
};

export function publicScheduleHubStatusLabel(
  event: PublicScheduleHubStatusInput
): { label: string; cancelled: boolean; tone: PublicScheduleHubStatusTone } {
  const { status, acceptingReservations } = event;
  if (
    status === "cancelled_weather" ||
    status === "cancelled_operational" ||
    status === "cancelled_minimum"
  ) {
    return { label: "中止", cancelled: true, tone: "bad" };
  }
  if (status === "confirmed") {
    return { label: "開催決定", cancelled: false, tone: "ok" };
  }
  if (status === "locked") {
    return { label: "開催予定", cancelled: false, tone: "muted" };
  }
  if (status === "open") {
    if (acceptingReservations) {
      return { label: "受付中", cancelled: false, tone: "ok" };
    }
    return { label: "対戦調整中", cancelled: false, tone: "muted" };
  }
  return { label: "—", cancelled: false, tone: "muted" };
}
