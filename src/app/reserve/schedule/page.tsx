import type { Metadata } from "next";

import { ScheduleHubClient } from "./schedule-hub-client";

export const metadata: Metadata = {
  title: "開催確認・試合予定 | 小学生サッカー対戦予約",
  description:
    "開催日ごとに参加チーム・試合予定・開催可否を確認できます。確認コードは不要です。",
};

export default function ReserveScheduleHubPage() {
  return <ScheduleHubClient />;
}
