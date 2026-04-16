/**
 * 管理API用: 開催日枠の PATCH / POST 共通処理（server のみ）。
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canAppendEventDaySlotForPhase,
  EVENT_DAY_SLOT_APPEND_REJECT_MESSAGE_JA,
} from "@/lib/event-days/event-day-slot-count-policy";

export const ADMIN_EVENT_DAY_SLOT_SELECT =
  "id, slot_code, phase, start_time, end_time, capacity, is_active, is_time_changed, is_locked" as const;

export type AdminEventDaySlotRow = {
  id: string;
  slot_code: string;
  phase: string;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
  is_time_changed: boolean;
  is_locked: boolean;
};

export function isSlotEditableEventDayStatus(status: string): boolean {
  return status === "draft" || status === "open";
}

/** アクティブな予約件数（枠編集の可否判定用） */
export async function countActiveReservationsForEventDay(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<{ count: number; errorMessage?: string }> {
  const { count, error } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("event_day_id", eventDayId)
    .eq("status", "active");
  if (error) {
    return { count: 0, errorMessage: error.message };
  }
  return { count: count ?? 0 };
}

export const SLOTS_BLOCKED_BY_RESERVATIONS_MESSAGE_JA =
  "アクティブな予約が1件以上あるため、この操作はできません。やむを得ない変更は「枠の強制変更」画面から実施してください。";

/** `time` / `datetime` 由来の文字列から HH:MM または HH:MM:SS を解釈 */
export function normalizePgTime(raw: string): string | null {
  const head = raw.trim().split(/[Zz+]/)[0]?.split(".")[0]?.trim() ?? "";
  const m = head.match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return m[2] !== undefined ? `${m[1]}:${m[2]}` : `${m[1]}:00`;
}

function timeLessThan(a: string, b: string): boolean {
  return a < b;
}

export function addOneHourPgTime(t: string): string {
  const parts = t.split(":").map((x) => Number(x));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  const d = new Date(Date.UTC(1970, 0, 1, h, m, sec));
  d.setUTCHours(d.getUTCHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

type PatchSlot = {
  id?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  isActive?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  is_active?: unknown;
};

export type SlotPatchRow = {
  id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  is_time_changed: boolean;
};

function parsePatchBody(json: unknown): { slots: PatchSlot[] } | null {
  if (json === null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (!Array.isArray(o.slots)) return null;
  return { slots: o.slots as PatchSlot[] };
}

export function parseSlotPatchRowsFromJson(json: unknown):
  | { ok: true; rows: SlotPatchRow[] }
  | { ok: false; error: string; status: number } {
  const parsed = parsePatchBody(json);
  if (!parsed?.slots?.length) {
    return {
      ok: false,
      error: "slots（1件以上の配列）を指定してください",
      status: 422,
    };
  }

  const rows: SlotPatchRow[] = [];
  for (const s of parsed.slots) {
    const sid = typeof s.id === "string" && s.id.length > 0 ? s.id : null;
    if (!sid) {
      return {
        ok: false,
        error: "各要素に有効な id（UUID）が必要です",
        status: 422,
      };
    }
    const stRaw =
      (typeof s.startTime === "string" ? s.startTime : null) ??
      (typeof s.start_time === "string" ? s.start_time : null);
    const etRaw =
      (typeof s.endTime === "string" ? s.endTime : null) ??
      (typeof s.end_time === "string" ? s.end_time : null);
    const stNorm = stRaw ? normalizePgTime(stRaw) : null;
    const etNorm = etRaw ? normalizePgTime(etRaw) : null;
    if (!stNorm || !etNorm) {
      return {
        ok: false,
        error: "startTime / endTime は HH:MM 形式で指定してください",
        status: 422,
      };
    }
    if (!timeLessThan(stNorm, etNorm)) {
      return {
        ok: false,
        error: "開始時刻は終了時刻より前である必要があります",
        status: 422,
      };
    }
    const actRaw = s.isActive ?? s.is_active;
    const isActive = actRaw === true || actRaw === false ? actRaw : null;
    if (isActive === null) {
      return {
        ok: false,
        error: "isActive（boolean）を指定してください",
        status: 422,
      };
    }
    rows.push({
      id: sid,
      start_time: stNorm,
      end_time: etNorm,
      is_active: isActive,
      is_time_changed: true,
    });
  }

  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) {
    return {
      ok: false,
      error: "slots 内に重複した id があります",
      status: 422,
    };
  }

  return { ok: true, rows };
}

export async function verifySlotIdsBelongToEventDay(
  supabase: SupabaseClient,
  eventDayId: string,
  ids: string[]
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: existing, error: exErr } = await supabase
    .from("event_day_slots")
    .select("id")
    .eq("event_day_id", eventDayId)
    .in("id", ids);
  if (exErr) {
    return { ok: false, error: exErr.message, status: 500 };
  }
  if (!existing || existing.length !== ids.length) {
    return {
      ok: false,
      error: "指定された枠の一部がこの開催日に属しません",
      status: 422,
    };
  }
  return { ok: true };
}

export async function applySlotPatchRows(
  supabase: SupabaseClient,
  eventDayId: string,
  rows: SlotPatchRow[]
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  for (const r of rows) {
    const { error: upErr } = await supabase
      .from("event_day_slots")
      .update({
        start_time: r.start_time,
        end_time: r.end_time,
        is_active: r.is_active,
        is_time_changed: r.is_time_changed,
      })
      .eq("id", r.id)
      .eq("event_day_id", eventDayId);
    if (upErr) {
      return { ok: false, error: upErr.message, status: 500 };
    }
  }
  return { ok: true };
}

export async function loadSlotsOrdered(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<
  { ok: true; slots: AdminEventDaySlotRow[] } | { ok: false; error: string }
> {
  const { data: slots, error: slErr } = await supabase
    .from("event_day_slots")
    .select(ADMIN_EVENT_DAY_SLOT_SELECT)
    .eq("event_day_id", eventDayId)
    .order("start_time", { ascending: true });
  if (slErr) {
    return { ok: false, error: slErr.message };
  }
  return { ok: true, slots: (slots ?? []) as AdminEventDaySlotRow[] };
}

function nextSuffix(codes: string[], prefix: "MORNING" | "AFTERNOON"): number {
  const re = prefix === "MORNING" ? /^MORNING_(\d+)$/ : /^AFTERNOON_(\d+)$/;
  let max = 0;
  for (const c of codes) {
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max + 1;
}

export async function appendEventDaySlotRow(
  supabase: SupabaseClient,
  eventDayId: string,
  phase: "morning" | "afternoon"
): Promise<
  | { ok: true; slot: AdminEventDaySlotRow }
  | { ok: false; error: string; status: number }
> {
  const { data: phaseRowsAll, error: cntErr } = await supabase
    .from("event_day_slots")
    .select("phase")
    .eq("event_day_id", eventDayId);
  if (cntErr) {
    return { ok: false, error: cntErr.message, status: 500 };
  }
  const morningN = (phaseRowsAll ?? []).filter((r) => r.phase === "morning").length;
  const afternoonN = (phaseRowsAll ?? []).filter((r) => r.phase === "afternoon").length;
  if (!canAppendEventDaySlotForPhase(morningN, afternoonN, phase)) {
    return {
      ok: false,
      error: EVENT_DAY_SLOT_APPEND_REJECT_MESSAGE_JA,
      status: 422,
    };
  }

  const { data: phaseSlots, error: psErr } = await supabase
    .from("event_day_slots")
    .select("slot_code, start_time, end_time")
    .eq("event_day_id", eventDayId)
    .eq("phase", phase)
    .order("start_time", { ascending: true });
  if (psErr) {
    return { ok: false, error: psErr.message, status: 500 };
  }
  const codes = (phaseSlots ?? []).map((r) => String(r.slot_code));
  const prefix = phase === "morning" ? "MORNING" : "AFTERNOON";
  const nextN = nextSuffix(codes, prefix);
  const slotCode = `${prefix}_${nextN}`;

  let startTime = "09:00:00";
  let endTime = "10:00:00";
  if (phase === "afternoon" && (!phaseSlots || phaseSlots.length === 0)) {
    startTime = "13:00:00";
    endTime = "14:00:00";
  }
  if (phaseSlots && phaseSlots.length > 0) {
    const last = phaseSlots[phaseSlots.length - 1]!;
    const lastEndNorm = normalizePgTime(String(last.end_time));
    if (lastEndNorm) {
      startTime = lastEndNorm;
      endTime = addOneHourPgTime(startTime);
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("event_day_slots")
    .insert({
      event_day_id: eventDayId,
      slot_code: slotCode,
      phase,
      start_time: startTime,
      end_time: endTime,
      capacity: 2,
      is_active: true,
      is_time_changed: false,
    })
    .select(ADMIN_EVENT_DAY_SLOT_SELECT)
    .single();
  if (insErr) {
    return { ok: false, error: insErr.message, status: 500 };
  }
  return { ok: true, slot: inserted as AdminEventDaySlotRow };
}
