import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 各開催日について、午前の有効枠のうちロックされていない枠だけを対象に、
 * 「まだ入るチーム数」（capacity - 予約数）を枠ごとに足し合わせた値。
 * カレンダー一覧の「残りN枠」表示用（受付不可の日は API 側で null にする想定）。
 */
export async function sumMorningRemainingVacanciesByEventDay(
  supabase: SupabaseClient,
  eventDayIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const id of eventDayIds) out.set(id, 0);
  if (eventDayIds.length === 0) return out;

  const { data: slots, error: slotsErr } = await supabase
    .from("event_day_slots")
    .select("id, event_day_id, capacity, is_locked")
    .in("event_day_id", eventDayIds)
    .eq("phase", "morning")
    .eq("is_active", true);

  if (slotsErr || !slots?.length) return out;

  const slotIds = slots.map((s) => String(s.id));
  const { data: resRows, error: resErr } = await supabase
    .from("reservations")
    .select("selected_morning_slot_id")
    .eq("status", "active")
    .in("selected_morning_slot_id", slotIds);

  if (resErr) return out;

  const countBySlot = new Map<string, number>();
  for (const sid of slotIds) countBySlot.set(sid, 0);
  for (const row of resRows ?? []) {
    const sid = row.selected_morning_slot_id as string | null;
    if (!sid) continue;
    countBySlot.set(sid, (countBySlot.get(sid) ?? 0) + 1);
  }

  for (const s of slots) {
    if (s.is_locked) continue;
    const sid = String(s.id);
    const cap =
      typeof s.capacity === "number" && Number.isFinite(s.capacity) && s.capacity >= 0
        ? s.capacity
        : 2;
    const used = countBySlot.get(sid) ?? 0;
    const rem = Math.max(0, cap - used);
    const edid = String(s.event_day_id);
    out.set(edid, (out.get(edid) ?? 0) + rem);
  }

  return out;
}
