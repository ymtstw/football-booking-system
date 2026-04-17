import type { Metadata } from "next";

import { ReserveCalendarClient } from "./reserve-calendar-client";

export const metadata: Metadata = {
  title: "開催日を選ぶ | 小学生サッカー対戦予約",
  description: "ご予約前の確認と開催日・午前枠の選択",
};

export default function ReserveCalendarPage() {
  return <ReserveCalendarClient />;
}
