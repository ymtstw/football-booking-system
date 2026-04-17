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
  const resIds = activeRows.map((r) => (r as { id: string }).id);
  if (resIds.length > 0) {
    const { data: lunchRows } = await supabase
      .from("reservation_lunch_items")
      .select("quantity")
      .in("reservation_id", resIds);
    totalMeals = (lunchRows ?? []).reduce(
      (s, m) => s + (Number((m as { quantity: number }).quantity) || 0),
      0
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
    warningCount,
    failedForDay,
  };
}

/** `event_date` が `afterEventDate` より後で、いちばん早い開催日のサマリ（無ければ null） */
export async function getNextDashboardEventDaySummaryAfter(
  supabase: SupabaseClient,
  afterEventDate: string
): Promise<DashboardEventDaySummaryPayload | null> {
  const { data: dayRaw, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, weather_status")
    .gt("event_date", afterEventDate)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!dayRaw) return null;

  return buildDashboardEventDaySummaryPayload(supabase, dayRaw as EventDayRow);
}
