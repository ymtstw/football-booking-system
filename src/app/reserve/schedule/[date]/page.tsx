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
    return { title: "対戦表・スケジュール | 小学生サッカー対戦予約" };
  }
  return {
    title: `${decoded} の対戦表・スケジュール | 小学生サッカー対戦予約`,
    description: "午前枠の状況と、確定後の対戦表を表示します。",
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
