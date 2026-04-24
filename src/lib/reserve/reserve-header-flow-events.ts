/**
 * 予約ヘッダーの戻ると、開催日別予約画面のフェーズ（入力↔確認）の同期用。
 * URL が変わらない確認画面があるため、カスタムイベントで連携する。
 */
export const RESERVE_DATE_PHASE_BROADCAST = "rp_reserve_date_phase_v1";
export const RESERVE_DATE_HEADER_BACK_REQUEST = "rp_reserve_date_header_back_v1";

export type ReserveDatePhaseBroadcastDetail = { phase: "edit" | "confirm" };
