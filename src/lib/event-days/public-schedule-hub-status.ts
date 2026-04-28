/**
 * 公開「開催確認・試合予定」系画面での開催日ステータス表示（DB status + acceptingReservations）。
 */

export type PublicScheduleHubStatusTone = "ok" | "muted" | "bad";

export type PublicScheduleHubStatusInput = {
  status: string;
  acceptingReservations: boolean;
  /** 対戦案内メール送信済み（公開側で「試合スケジュール確定」扱い） */
  matchingProposalNoticeSentAt?: string | null;
};

export function publicScheduleHubStatusLabel(
  event: PublicScheduleHubStatusInput
): { label: string; cancelled: boolean; tone: PublicScheduleHubStatusTone } {
  const { status, acceptingReservations, matchingProposalNoticeSentAt } = event;
  if (
    status === "cancelled_weather" ||
    status === "cancelled_operational" ||
    status === "cancelled_minimum"
  ) {
    return { label: "中止", cancelled: true, tone: "bad" };
  }

  if (acceptingReservations) {
    return { label: "予約受付中", cancelled: false, tone: "ok" };
  }

  // ユーザー向け「確定」判定は、2日前16:00の案内メール送信後（matchingProposalNoticeSentAt）
  if (matchingProposalNoticeSentAt) {
    return { label: "試合スケジュール確定", cancelled: false, tone: "ok" };
  }

  // 締切後〜案内メール送信前（または公開対象だが未送信）の間
  if (status === "open" || status === "locked" || status === "confirmed") {
    return { label: "試合スケジュール確認中", cancelled: false, tone: "muted" };
  }

  return { label: "—", cancelled: false, tone: "muted" };
}
