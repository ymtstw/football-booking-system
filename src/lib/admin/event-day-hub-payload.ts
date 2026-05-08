import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildDashboardEventDaySummaryPayload,
  isValidIsoDateParam,
} from "./dashboard-event-day-summary";
import type { DashboardEventDaySummaryPayload } from "./dashboard-event-day-summary.types";

/** 運営まとめ画面・ダッシュ等で共有する開催日1件の表示用行（DB列の一部） */
export type EventDayHubDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
  reservation_deadline_at: string;
  final_day_before_notice_completed_at?: string | null;
  notes: string | null;
};

export type EventDayHubPayload = {
  day: EventDayHubDayRow;
  summary: DashboardEventDaySummaryPayload;
};

const HUB_SELECT =
  "id, event_date, grade_band, status, weather_status, reservation_deadline_at, final_day_before_notice_completed_at, notes" as const;

type SummaryInput = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
};

/**
 * 開催日の運営まとめ（/admin/event-days/[id]）用の読み取りを1経路に集約（指標ズレ防止・保守性）。
 * 集計ロジックは buildDashboardEventDaySummaryPayload に委譲。
 */
export async function loadEventDayHubPayload(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<
  | { ok: true; data: EventDayHubPayload }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "db_error"; message: string }
> {
  const { data: dayRaw, error } = await supabase
    .from("event_days")
    .select(HUB_SELECT)
    .eq("id", eventDayId)
    .maybeSingle();

  if (error) {
    return { ok: false, kind: "db_error", message: error.message };
  }
  if (!dayRaw) {
    return { ok: false, kind: "not_found" };
  }

  const day = dayRaw as EventDayHubDayRow;
  const summaryInput: SummaryInput = {
    id: day.id,
    event_date: day.event_date,
    grade_band: day.grade_band,
    status: day.status,
    weather_status: day.weather_status,
  };

  const summary = await buildDashboardEventDaySummaryPayload(supabase, summaryInput);

  return { ok: true, data: { day, summary } };
}

/**
 * ダッシュ「次の開催日を読み込む」用。`afterEventDate` より後の最も早い開催日を運営まとめと同じ SELECT 経路で返す。
 */
export async function loadNextEventDayHubSummaryAfter(
  supabase: SupabaseClient,
  afterEventDate: string
): Promise<DashboardEventDaySummaryPayload | null> {
  if (!isValidIsoDateParam(afterEventDate)) {
    throw new Error("after は YYYY-MM-DD 形式の日付である必要があります");
  }

  const { data: idRow, error } = await supabase
    .from("event_days")
    .select("id")
    .gt("event_date", afterEventDate)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!idRow?.id) {
    return null;
  }

  const loaded = await loadEventDayHubPayload(supabase, idRow.id);
  if (!loaded.ok) {
    if (loaded.kind === "db_error") {
      throw new Error(loaded.message);
    }
    return null;
  }

  return loaded.data.summary;
}
