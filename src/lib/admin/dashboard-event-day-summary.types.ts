/** ダッシュボード開催日カード用 JSON（API／クライアント／サーバー共通） */

/** active 予約に紐づく昼食明細をメニュー名（予約時スナップショット）で集計した行 */
export type LunchMenuCountLine = {
  itemName: string;
  quantity: number;
};

export type DashboardEventDaySummaryPayload = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
  activeTeamCount: number;
  totalParticipants: number;
  totalMeals: number;
  /** 食数が 0 のときは空配列 */
  lunchByMenu: LunchMenuCountLine[];
  warningCount: number | null;
  failedForDay: number;
};
