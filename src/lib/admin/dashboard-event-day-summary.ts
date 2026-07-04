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

/**
 * 集計で使う「当日の有効予約」1件分（参加人数＋昼食内訳）。
 * ハブ画面などが既に取得済みの場合に渡すと、集計側の予約・昼食クエリを省略できる。
 */
export type ActiveReservationForSummary = {
  id: string;
  participant_count: number;
  reservation_lunch_items:
    | { item_name_snapshot: string; quantity: number }[]
    | null;
};

/**
 * 開催日1件分のダッシュボード用集計。
 * opts.activeReservations を渡すと予約・昼食の取得を省略する（呼び出し側で取得済みのとき用・Disk IO 削減）。
 */
export async function buildDashboardEventDaySummaryPayload(
  supabase: SupabaseClient,
  day: EventDayRow,
  opts?: { activeReservations?: ActiveReservationForSummary[] }
): Promise<DashboardEventDaySummaryPayload> {
  const dayId = day.id;
  const prefetched = opts?.activeReservations;

  const runPromise = supabase
    .from("matching_runs")
    .select("warning_count")
    .eq("event_day_id", dayId)
    .eq("is_current", true)
    .maybeSingle();
  const failedPromise = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("event_day_id", dayId)
    .eq("status", "failed")
    .is("resolved_at", null);

  // 予約（参加人数）は事前取得があれば再取得しない
  const activeRowsPromise: Promise<{ id: string; participant_count: number }[]> =
    prefetched
      ? Promise.resolve(
          prefetched.map((r) => ({
            id: r.id,
            participant_count: r.participant_count,
          }))
        )
      : (async () => {
          const res = await supabase
            .from("reservations")
            .select("id, participant_count")
            .eq("event_day_id", dayId)
            .eq("status", "active");
          return (res.data ?? []) as {
            id: string;
            participant_count: number;
          }[];
        })();

  const [activeRows, runRes, failedRes] = await Promise.all([
    activeRowsPromise,
    runPromise,
    failedPromise,
  ]);

  const activeTeamCount = activeRows.length;
  const totalParticipants = activeRows.reduce(
    (s, r) => s + (Number(r.participant_count) || 0),
    0
  );

  // 昼食行: 事前取得があればそこから、なければ有効予約IDで取得
  let lunchRows: { item_name_snapshot: string; quantity: number }[];
  if (prefetched) {
    lunchRows = prefetched.flatMap((r) => r.reservation_lunch_items ?? []);
  } else {
    const resIds = activeRows.map((r) => r.id);
    if (resIds.length > 0) {
      const { data } = await supabase
        .from("reservation_lunch_items")
        .select("item_name_snapshot, quantity")
        .in("reservation_id", resIds);
      lunchRows = (data ?? []) as {
        item_name_snapshot: string;
        quantity: number;
      }[];
    } else {
      lunchRows = [];
    }
  }

  let totalMeals = 0;
  const lunchByMenu: { itemName: string; quantity: number }[] = [];
  const byName = new Map<string, number>();
  for (const row of lunchRows) {
    const name = String(row.item_name_snapshot ?? "").trim();
    const label = name.length > 0 ? name : "（名称なし）";
    const q = Number(row.quantity) || 0;
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
