import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function formatHm(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : t.slice(0, 5);
}

function phaseLabel(phase: string): string {
  if (phase === "morning") return "午前";
  if (phase === "afternoon") return "午後";
  return phase;
}

/**
 * 当該予約が関わる試合行のみ、前日通知用の短文リストにする。
 */
export async function buildReservationScheduleLines(
  supabase: SupabaseClient,
  eventDayId: string,
  reservationId: string
): Promise<string[]> {
  const { data: run, error: runErr } = await supabase
    .from("matching_runs")
    .select("id")
    .eq("event_day_id", eventDayId)
    .eq("is_current", true)
    .maybeSingle();

  if (runErr || !run?.id) {
    return [];
  }

  const { data: assigns, error: asgErr } = await supabase
    .from("match_assignments")
    .select(
      "match_phase, reservation_a_id, reservation_b_id, referee_reservation_id, event_day_slot_id"
    )
    .eq("matching_run_id", run.id);

  if (asgErr || !assigns?.length) {
    return [];
  }

  const relevant = assigns.filter(
    (a) =>
      a.reservation_a_id === reservationId ||
      a.reservation_b_id === reservationId ||
      a.referee_reservation_id === reservationId
  );
  if (relevant.length === 0) {
    return [];
  }

  const slotIds = [...new Set(relevant.map((a) => a.event_day_slot_id as string))];
  const { data: slots, error: slotErr } = await supabase
    .from("event_day_slots")
    .select("id, start_time, end_time, phase")
    .in("id", slotIds);

  if (slotErr || !slots?.length) {
    return [];
  }

  const slotById = new Map(slots.map((s) => [s.id as string, s]));

  const resIds = new Set<string>();
  for (const a of relevant) {
    resIds.add(a.reservation_a_id as string);
    resIds.add(a.reservation_b_id as string);
    if (a.referee_reservation_id) resIds.add(a.referee_reservation_id as string);
  }

  const { data: resRows, error: resErr } = await supabase
    .from("reservations")
    .select("id, team_id, teams ( team_name )")
    .in("id", [...resIds]);

  if (resErr || !resRows) {
    return [];
  }

  const teamName = (rid: string): string => {
    const row = resRows.find((r) => r.id === rid);
    const t = row?.teams;
    const name =
      Array.isArray(t) && t[0]
        ? (t[0] as { team_name?: string }).team_name
        : t && typeof t === "object" && "team_name" in t
          ? (t as { team_name?: string }).team_name
          : null;
    return name?.trim() || "（チーム名未設定）";
  };

  const sorted = [...relevant].sort((a, b) => {
    const sa = slotById.get(a.event_day_slot_id as string);
    const sb = slotById.get(b.event_day_slot_id as string);
    const ta = sa?.start_time ? String(sa.start_time) : "";
    const tb = sb?.start_time ? String(sb.start_time) : "";
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.match_phase).localeCompare(String(b.match_phase));
  });

  const lines: string[] = [];
  for (const a of sorted) {
    const slot = slotById.get(a.event_day_slot_id as string);
    const st = slot?.start_time ? formatHm(String(slot.start_time)) : "?";
    const en = slot?.end_time ? formatHm(String(slot.end_time)) : "?";
    const ph = phaseLabel(String(a.match_phase));
    const na = teamName(a.reservation_a_id as string);
    const nb = teamName(a.reservation_b_id as string);
    const refId = a.referee_reservation_id as string | null;
    const refPart = refId ? `／審判: ${teamName(refId)}` : "";
    lines.push(`${ph} ${st}–${en}  ${na} vs ${nb}${refPart}`);
  }

  return lines;
}
