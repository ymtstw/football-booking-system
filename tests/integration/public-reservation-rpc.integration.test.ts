import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import {
  deleteEventDayById,
  insertEventDayWithSlots,
} from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const futureDeadlineIso = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
const pastDeadlineIso = "2000-01-01T00:00:00.000Z";

function baseCreateRpcParams(
  eventDayId: string,
  morningSlotId: string,
  tokenHash: string
) {
  return {
    p_event_day_id: eventDayId,
    p_selected_morning_slot_id: morningSlotId,
    p_team_name: "結合テストチーム",
    p_strength_category: "strong",
    p_contact_name: "テスト太郎",
    p_contact_email: `integration-${eventDayId.slice(0, 8)}@example.test`,
    p_contact_phone: "09012345678",
    p_participant_count: 8,
    p_meal_count: 0,
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
  };
}

describe.skipIf(!hasSupabaseEnv())("integration: create_public_reservation / cancel_public_reservation", () => {
  it("無効な token hash 長 → invalid_input（create）", async () => {
    const supabase = getIntegrationSupabase();
    const { data, error } = await supabase.rpc("create_public_reservation", {
      ...baseCreateRpcParams(
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "short"
      ),
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: false, error: "invalid_input" });
  });

  it("存在しない開催日 UUID → event_not_found", async () => {
    const supabase = getIntegrationSupabase();
    const tokenHash = randomBytes(32).toString("hex");
    const { data, error } = await supabase.rpc("create_public_reservation", {
      ...baseCreateRpcParams(
        "00000000-0000-4000-8000-000000000099",
        "00000000-0000-4000-8000-000000000088",
        tokenHash
      ),
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: false, error: "event_not_found" });
  });

  it("draft + 締切未来 → event_not_open", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "draft",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    try {
      const supabase = getIntegrationSupabase();
      const tokenHash = randomBytes(32).toString("hex");
      const { data, error } = await supabase.rpc("create_public_reservation", {
        ...baseCreateRpcParams(eventDayId, morningSlotId, tokenHash),
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ success: false, error: "event_not_open" });
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("open + 締切過去 → deadline_passed", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: pastDeadlineIso,
    });
    try {
      const supabase = getIntegrationSupabase();
      const tokenHash = randomBytes(32).toString("hex");
      const { data, error } = await supabase.rpc("create_public_reservation", {
        ...baseCreateRpcParams(eventDayId, morningSlotId, tokenHash),
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ success: false, error: "deadline_passed" });
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("open + 3+3: 6件まで成功し7件目は day_full", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    try {
      const supabase = getIntegrationSupabase();
      const { data: morningRows, error: mErr } = await supabase
        .from("event_day_slots")
        .select("id")
        .eq("event_day_id", eventDayId)
        .eq("phase", "morning")
        .eq("is_active", true)
        .order("slot_code", { ascending: true });
      expect(mErr).toBeNull();
      const ids = (morningRows ?? []).map((r) => r.id as string);
      expect(ids.length).toBe(3);

      const slotSequence = [ids[0], ids[0], ids[1], ids[1], ids[2], ids[2]];
      for (let i = 0; i < 6; i++) {
        const tokenHash = randomBytes(32).toString("hex");
        const { data, error } = await supabase.rpc("create_public_reservation", {
          ...baseCreateRpcParams(eventDayId, slotSequence[i]!, tokenHash),
          p_contact_email: `cap-${i}-${eventDayId.slice(0, 8)}@example.test`,
        });
        expect(error).toBeNull();
        expect(data).toMatchObject({ success: true });
      }

      const tokenHash7 = randomBytes(32).toString("hex");
      const { data: seventh, error: e7 } = await supabase.rpc("create_public_reservation", {
        ...baseCreateRpcParams(eventDayId, ids[0]!, tokenHash7),
        p_contact_email: `cap-7-${eventDayId.slice(0, 8)}@example.test`,
      });
      expect(e7).toBeNull();
      expect(seventh).toMatchObject({ success: false, error: "day_full" });
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("open + 締切未来 → 成功のあと locked にすると cancel は event_not_open", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    try {
      const supabase = getIntegrationSupabase();
      const tokenPlain = randomBytes(32).toString("hex");
      const tokenHash = hashReservationTokenPlainForTest(tokenPlain);

      const { data: created, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        { ...baseCreateRpcParams(eventDayId, morningSlotId, tokenHash) }
      );
      expect(cErr).toBeNull();
      expect(created).toMatchObject({ success: true });

      const { error: lockErr } = await supabase
        .from("event_days")
        .update({ status: "locked" })
        .eq("id", eventDayId);
      expect(lockErr).toBeNull();

      const { data: cancelled, error: xErr } = await supabase.rpc(
        "cancel_public_reservation",
        { p_token_hash: tokenHash }
      );
      expect(xErr).toBeNull();
      expect(cancelled).toMatchObject({ success: false, error: "event_not_open" });
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("cancel: 短い hash → invalid_input", async () => {
    const supabase = getIntegrationSupabase();
    const { data, error } = await supabase.rpc("cancel_public_reservation", {
      p_token_hash: "x",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: false, error: "invalid_input" });
  });

  it("cancel: 存在しない hash → not_found", async () => {
    const supabase = getIntegrationSupabase();
    const ghostHash = randomBytes(32).toString("hex");
    const { data, error } = await supabase.rpc("cancel_public_reservation", {
      p_token_hash: ghostHash,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: false, error: "not_found" });
  });
});
