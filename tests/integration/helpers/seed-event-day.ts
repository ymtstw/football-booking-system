import { randomBytes } from "node:crypto";

import { toEventDaySlotRows } from "@/domains/event-days/default-slots";

import { getIntegrationSupabase } from "./service-role-client";

let serial = 0;

/**
 * UNIQUE(event_date) 用。DB に残った過去のテスト行と衝突しないよう、
 * 2070 年台のランダム日オフセット＋連番で採番する。
 */
export function nextUniqueEventDate(): string {
  serial += 1;
  const salt = randomBytes(4).readUInt32BE(0);
  const dayOffset = (serial * 7919 + salt) % 12000;
  const base = new Date(Date.UTC(2070, 0, 1));
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return base.toISOString().slice(0, 10);
}

export async function insertEventDayWithSlots(input: {
  status: "draft" | "open" | "locked";
  reservationDeadlineAtIso: string;
  eventDate?: string;
  /** 既定以外にすると、Cron 系テストの掃除用に `deleteEventDaysByGradeBand` と併用しやすい */
  gradeBand?: string;
}): Promise<{
  eventDayId: string;
  morningSlotId: string;
  eventDate: string;
}> {
  const supabase = getIntegrationSupabase();
  const event_date = input.eventDate ?? nextUniqueEventDate();
  const grade_band = input.gradeBand ?? "結合テスト";
  const { data: day, error } = await supabase
    .from("event_days")
    .insert({
      event_date,
      grade_band,
      status: input.status,
      reservation_deadline_at: input.reservationDeadlineAtIso,
    })
    .select("id")
    .single();
  if (error) throw error;

  const slotRows = toEventDaySlotRows(day.id);
  const { error: slotsErr } = await supabase.from("event_day_slots").insert(slotRows);
  if (slotsErr) {
    await supabase.from("event_days").delete().eq("id", day.id);
    throw slotsErr;
  }

  const { data: morning, error: mErr } = await supabase
    .from("event_day_slots")
    .select("id")
    .eq("event_day_id", day.id)
    .eq("phase", "morning")
    .order("slot_code", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!morning) throw new Error("午前枠が取得できません");

  return { eventDayId: day.id, morningSlotId: morning.id, eventDate: event_date };
}

/**
 * 開催日と依存行を削除。
 * `reservations` は `event_days` に ON DELETE RESTRICT のため、
 * 先に予約・マッチング行を掃除してから `event_days` を消す。
 */
export async function deleteEventDayById(eventDayId: string): Promise<void> {
  const supabase = getIntegrationSupabase();

  const { error: delRunErr } = await supabase
    .from("matching_runs")
    .delete()
    .eq("event_day_id", eventDayId);
  if (delRunErr) throw delRunErr;

  const { data: resList, error: resListErr } = await supabase
    .from("reservations")
    .select("id, team_id")
    .eq("event_day_id", eventDayId);
  if (resListErr) throw resListErr;

  const resIds = (resList ?? []).map((r) => r.id);
  const teamIds = [...new Set((resList ?? []).map((r) => r.team_id))];

  const { error: nDayErr } = await supabase.from("notifications").delete().eq("event_day_id", eventDayId);
  if (nDayErr) throw nDayErr;
  if (resIds.length > 0) {
    const { error: nErr } = await supabase.from("notifications").delete().in("reservation_id", resIds);
    if (nErr) throw nErr;
  }

  const { error: delResErr } = await supabase.from("reservations").delete().eq("event_day_id", eventDayId);
  if (delResErr) throw delResErr;

  if (teamIds.length > 0) {
    const { error: teamErr } = await supabase.from("teams").delete().in("id", teamIds);
    if (teamErr) throw teamErr;
  }

  const { error: delDayErr } = await supabase.from("event_days").delete().eq("id", eventDayId);
  if (delDayErr) throw delDayErr;
}

/** Cron / JOB02 結合テスト用。同一 grade_band の開催日をまとめて削除する */
export async function deleteEventDaysByGradeBand(gradeBand: string): Promise<void> {
  const supabase = getIntegrationSupabase();
  await supabase.from("event_days").delete().eq("grade_band", gradeBand);
}
