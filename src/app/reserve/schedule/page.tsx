import type { Metadata } from "next";

import { ScheduleHubClient } from "./schedule-hub-client";
import { type EventDayPublic } from "../reserve-event-days-calendar";
import { loadPublicEventDaysList } from "@/lib/event-days/load-public-event-days-list";

/** 締切・予約受付可否など時刻依存フィールドをビルド時に固定しない */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "開催確認・試合予定 | 小学生サッカー対戦予約",
  description:
    "開催日ごとに参加チーム・試合予定・開催可否を確認できます。確認コードは不要です。",
};

export default async function ReserveScheduleHubPage() {
  const result = await loadPublicEventDaysList();
  const initialEventDays = result.ok ? (result.eventDays as EventDayPublic[]) : [];
  const initialListError = result.ok ? null : result.message;

  return (
    <ScheduleHubClient initialEventDays={initialEventDays} initialListError={initialListError} />
  );
}
