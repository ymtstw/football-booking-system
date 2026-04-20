import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DashboardEventDaySummaryPayload } from "./dashboard-event-day-summary.types";

export type { DashboardEventDaySummaryPayload } from "./dashboard-event-day-summary.types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDateParam(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

type EventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
};

/** 開催日1件分のダッシュボード用集計 */
export async function buildDashboardEventDaySummaryPayload(
  supabase: SupabaseClient,
  day: EventDayRow
): Promise<DashboardEventDaySummaryPayload> {
  const dayId = day.id;

  const [
    activeRes,
    partRes,
    runRes,
    failedRes,
  ] = await Promise.all([
    supabase.from("reservations").select("id").eq("event_day_id", dayId).eq("status", "active"),
    supabase
      .from("reservations")
      .select("participant_count")
      .eq("event_day_id", dayId)
      .eq("status", "active"),
    supabase
      .from("matching_runs")
      .select("warning_count")
      .eq("event_day_id", dayId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("event_day_id", dayId)
      .eq("status", "failed"),
  ]);

  const activeRows = activeRes.data ?? [];
  const activeTeamCount = activeRows.length;
  const totalParticipants = (partRes.data ?? []).reduce(
    (s, r) => s + (Number((r as { participant_count: number }).participant_count) || 0),
    0
  );

  let totalMeals = 0;
  const lunchByMenu: { itemName: string; quantity: number }[] = [];
  const resIds = activeRows.map((r) => (r as { id: string }).id);
  if (resIds.length > 0) {
    const { data: lunchRows } = await supabase
      .from("reservation_lunch_items")
      .select("item_name_snapshot, quantity")
      .in("reservation_id", resIds);
    const byName = new Map<string, number>();
    for (const row of lunchRows ?? []) {
      const name = String((row as { item_name_snapshot: string }).item_name_snapshot ?? "").trim();
      const label = name.length > 0 ? name : "（名称なし）";
      const q = Number((row as { quantity: number }).quantity) || 0;
      if (q <= 0) continue;
      byName.set(label, (byName.get(label) ?? 0) + q);
      totalMeals += q;
    }
    for (const [itemName, quantity] of byName) {
      lunchByMenu.push({ itemName, quantity });
    }
    lunchByMenu.sort(
      (a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName, "ja")
    );
  }

  const run = runRes.data as { warning_count: number } | null;
  const warningCount = run != null ? run.warning_count : null;
  const failedForDay = failedRes.count ?? 0;

  return {
    ...day,
    activeTeamCount,
    totalParticipants,
    totalMeals,
    lunchByMenu,
    warningCount,
    failedForDay,
  };
}
