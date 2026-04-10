import { notFound } from "next/navigation";

import { ReserveDateClient } from "./reserve-date-client";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function ReserveByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const decoded = decodeURIComponent(date ?? "").trim();
  if (!isIsoDateOnly(decoded)) notFound();

  return <ReserveDateClient eventDate={decoded} />;
}
