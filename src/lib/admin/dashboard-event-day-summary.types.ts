/** ダッシュボード開催日カード用 JSON（API／クライアント／サーバー共通） */

export type DashboardEventDaySummaryPayload = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
  activeTeamCount: number;
  totalParticipants: number;
  totalMeals: number;
  warningCount: number | null;
  failedForDay: number;
};
