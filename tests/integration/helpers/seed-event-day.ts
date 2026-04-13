import { toEventDaySlotRows } from "@/domains/event-days/default-slots";

import { getIntegrationSupabase } from "./service-role-client";

let serial = 0;

/** UNIQUE(event_date) 用のテスト日付を採番 */
export function nextUniqueEventDate(): string {
  serial += 1;
  const day = 1 + (serial % 28);
  const month = 1 + (((serial / 28) | 0) % 12);
  return `2099-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function insertEventDayWithSlots(input: {
  status: "draft" | "open" | "locked";
  reservationDeadlineAtIso: string;
  eventDate?: string;
}): Promise<{
  eventDayId: string;
  morningSlotId: string;
  eventDate: string;
}> {
  const supabase = getIntegrationSupabase();
  const event_date = input.eventDate ?? nextUniqueEventDate();
  const { data: day, error } = await supabase
    .from("event_days")
    .insert({
      event_date,
      grade_band: "結合テスト",
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

/** 開催日と依存行を削除（CASCADE 前提） */
export async function deleteEventDayById(eventDayId: string): Promise<void> {
  const supabase = getIntegrationSupabase();
  await supabase.from("event_days").delete().eq("id", eventDayId);
}
