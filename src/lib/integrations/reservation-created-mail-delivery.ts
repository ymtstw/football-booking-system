import "server-only";

/**
 * 予約完了メールの「送達結果」統合口。
 * 将来: Outbox + Worker で Webhook 再送、または Resend の Inbound Webhook と突合せるなどをここに集約しやすい。
 * 確認コードの平文はイベントに含めない（外部転送時の漏えい防止）。
 */

export type ReservationCreatedMailDeliveryTrigger =
  | "public_reservation_created"
  | "admin_resend";

export type ReservationCreatedMailDeliveryOutcome =
  | "sent"
  | "failed"
  /** RESEND_* 未設定などで送信処理自体をスキップした場合（notifications は pending のまま） */
  | "skipped_no_mailer";

export type ReservationCreatedMailDeliveryEvent = {
  templateKey: "reservation_created";
  reservationId: string;
  notificationId?: string;
  trigger: ReservationCreatedMailDeliveryTrigger;
  outcome: ReservationCreatedMailDeliveryOutcome;
  occurredAt: string;
  /** failed 時のみ（運営・自社 Webhook 向け。長文は呼び出し側で整形済み想定） */
  errorMessage?: string;
};

/**
 * 送達結果の通知。現状はフックのみ（将来 webhook / キュー実装の差し込み口）。
 * 必ず例外を握りつぶし、メール送信本体を失敗させない。
 */
export async function dispatchReservationCreatedMailDeliveryEvent(
  event: ReservationCreatedMailDeliveryEvent
): Promise<void> {
  try {
    if (process.env.NODE_ENV === "development") {
      // 個人情報は出さず、突合用に最小フィールドのみ
      console.debug(
        "[reservation-created-mail] delivery event",
        event.outcome,
        event.trigger,
        event.reservationId
      );
    }
    // 将来例: await insertWebhookOutboxRow(event);
    // 将来例: await postInternalWebhook("/hooks/reservation-mail", event);
  } catch (e) {
    console.warn("[reservation-created-mail] delivery integration failed:", e);
  }
}
