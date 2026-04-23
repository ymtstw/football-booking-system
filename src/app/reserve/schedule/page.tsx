import type { Metadata } from "next";

import { ScheduleHubClient } from "./schedule-hub-client";

export const metadata: Metadata = {
  title: "対戦表・スケジュール | 小学生サッカー対戦予約",
  description:
    "開催日ごとの午前枠の状況と、編成確定後の対戦表を確認できます（確認コード不要）。",
};

export default function ReserveScheduleHubPage() {
  return <ScheduleHubClient />;
}
