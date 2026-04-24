import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScheduleDayClient } from "./schedule-day-client";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const decoded = decodeURIComponent(date ?? "").trim();
  if (!isIsoDateOnly(decoded)) {
    return { title: "開催確認・試合予定 | 小学生サッカー対戦予約" };
  }
  return {
    title: `${decoded} の参加チーム・試合予定 | 小学生サッカー対戦予約`,
    description:
      "参加チームの枠状況・試合スケジュール（確定後）・開催可否を表示します。",
  };
}

export default async function ReserveScheduleDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const decoded = decodeURIComponent(date ?? "").trim();
  if (!isIsoDateOnly(decoded)) notFound();

  return <ScheduleDayClient eventDate={decoded} />;
}
