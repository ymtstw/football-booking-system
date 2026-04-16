import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** 今日（東京）の ISO 日付以降で、いちばん早い `event_days.event_date`（無ければ null） */
export async function getNearestUpcomingEventDateIso(
  supabase: SupabaseClient,
  todayTokyoIso: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("event_days")
    .select("event_date")
    .gte("event_date", todayTokyoIso)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  const row = data as { event_date: string } | null;
  return row?.event_date ?? null;
}
