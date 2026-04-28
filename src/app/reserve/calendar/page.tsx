import type { Metadata } from "next";

import { ReserveCalendarClient } from "./reserve-calendar-client";
import { type EventDayPublic } from "../reserve-event-days-calendar";
import { loadPublicEventDaysList } from "@/lib/event-days/load-public-event-days-list";

/** 締切・予約受付可否など時刻依存フィールドをビルド時に固定しない */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "開催日を選ぶ | 小学生サッカー対戦予約",
  description: "ご予約前の確認事項への同意と、開催日・午前枠の選択",
};

export default async function ReserveCalendarPage() {
  const result = await loadPublicEventDaysList();
  const initialEventDays = result.ok ? (result.eventDays as EventDayPublic[]) : [];
  const initialListError = result.ok ? null : result.message;

  return (
    <ReserveCalendarClient initialEventDays={initialEventDays} initialListError={initialListError} />
  );
}
