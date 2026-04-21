import { getIntegrationSupabase } from "./service-role-client";

const ZERO = "00000000-0000-0000-0000-000000000000";

/**
 * 結合テスト用に編成・予約・開催日を空に近づける（FK 順序あり）。
 * JOB01/JOB02 で event_date 一意・東京日の衝突を避けるため beforeAll で使用。
 */
export async function deleteAllEventDaysForIntegration(): Promise<void> {
  const supabase = getIntegrationSupabase();

  const { error: runErr } = await supabase
    .from("matching_runs")
    .delete()
    .neq("id", ZERO);
  if (runErr) throw runErr;

  const { error: resErr } = await supabase
    .from("reservations")
    .delete()
    .neq("id", ZERO);
  if (resErr) throw resErr;

  const { error } = await supabase
    .from("event_days")
    .delete()
    .neq("id", ZERO);
  if (error) throw error;
}
