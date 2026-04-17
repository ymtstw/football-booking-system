import { notFound } from "next/navigation";

import { ReserveDateClient } from "./reserve-date-client";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function ReserveByDatePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams?: Promise<{ morningSlot?: string | string[] }>;
}) {
  const { date } = await params;
  const decoded = decodeURIComponent(date ?? "").trim();
  if (!isIsoDateOnly(decoded)) notFound();

  const sp = searchParams ? await searchParams : {};
  const raw = sp.morningSlot;
  const morningSlot =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return <ReserveDateClient eventDate={decoded} initialMorningSlotId={morningSlot} />;
}
