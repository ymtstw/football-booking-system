import { notFound } from "next/navigation";

import { ReserveDateClient } from "./reserve-date-client";
import { loadPublicAvailabilityByEventDate } from "@/lib/event-days/load-public-availability-by-date";
import { fetchEffectiveLunchMenuItemsForEventDay } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";
import { createServiceRoleClient } from "@/lib/supabase/service";

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

  const avail = await loadPublicAvailabilityByEventDate(decoded);

  let initialAvailability = null;
  let initialLoadIssue: null | { kind: "no_open_day" } | { kind: "error"; message: string } = null;
  let initialLunchMenus: LunchMenuItemPublic[] | null = null;

  if (avail.ok) {
    initialAvailability = avail.payload;
    const supabase = createServiceRoleClient();
    const { items, dbError } = await fetchEffectiveLunchMenuItemsForEventDay(
      supabase,
      avail.payload.eventDayId
    );
    initialLunchMenus = dbError ? [] : items;
  } else if (avail.notFound) {
    initialLoadIssue = { kind: "no_open_day" };
    initialLunchMenus = null;
  } else {
    initialLoadIssue = { kind: "error", message: avail.error };
    initialLunchMenus = null;
  }

  return (
    <ReserveDateClient
      eventDate={decoded}
      initialMorningSlotId={morningSlot}
      initialAvailability={initialAvailability}
      initialLoadIssue={initialLoadIssue}
      initialLunchMenus={initialLunchMenus}
    />
  );
}
