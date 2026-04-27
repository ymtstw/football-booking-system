import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildMatchingAssignments } from "@/domains/matching/build-matching-assignments";

import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { testReservationPublicRef } from "./helpers/test-reservation-public-ref";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const futureDeadlineIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

function baseCreateRpcParams(eventDayId: string, morningSlotId: string, tokenHash: string, emailSuffix: string) {
  return {
    p_event_day_id: eventDayId,
    p_selected_morning_slot_id: morningSlotId,
    p_team_name: "結合テストチーム",
    p_strength_category: "strong" as const,
    p_contact_name: "テスト太郎",
    p_contact_email: `undo-${emailSuffix}@example.test`,
    p_contact_phone: "09012345678",
    p_participant_count: 8,
    p_lunch_items: [] as unknown[],
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
    p_public_ref: testReservationPublicRef(),
  };
}

describe.skipIf(!hasSupabaseEnv())("integration: admin_undo_afternoon_matching（TC-EX-UN-200）", () => {
  it("confirmed 後に RPC で巻き戻し→locked", async () => {
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
      const morningIds = (morningRows ?? []).map((r) => r.id as string);
      expect(morningIds.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const tokenPlain = randomBytes(32).toString("hex");
        const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
        const { data: created, error: cErr } = await supabase.rpc("create_public_reservation", {
          ...baseCreateRpcParams(eventDayId, morningIds[i]!, tokenHash, `${eventDayId.slice(0, 8)}-${i}`),
        });
        expect(cErr).toBeNull();
        expect(created).toMatchObject({ success: true });
      }

      await supabase.from("event_days").update({ status: "locked" }).eq("id", eventDayId);

      const { data: slots, error: sErr } = await supabase
        .from("event_day_slots")
        .select("id, slot_code, phase, is_active")
        .eq("event_day_id", eventDayId)
        .order("slot_code", { ascending: true });
      expect(sErr).toBeNull();

      const { data: reservations, error: rErr } = await supabase
        .from("reservations")
        .select(
          `
          id,
          selected_morning_slot_id,
          team_id,
          teams ( strength_category, representative_grade_year )
        `
        )
        .eq("event_day_id", eventDayId)
        .eq("status", "active");
      expect(rErr).toBeNull();

      const built = buildMatchingAssignments({
        slots: (slots ?? []) as Parameters<typeof buildMatchingAssignments>[0]["slots"],
        reservationsActive: (reservations ?? []) as Parameters<
          typeof buildMatchingAssignments
        >[0]["reservationsActive"],
        currentAssignments: [],
      });
      expect(built.assignments.length).toBeGreaterThan(0);

      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_apply_matching_run", {
        p_event_day_id: eventDayId,
        p_assignments: built.assignments,
      });
      expect(rpcErr).toBeNull();
      expect(rpcData).toMatchObject({ success: true });

      const { data: undoData, error: undoErr } = await supabase.rpc("admin_undo_afternoon_matching", {
        p_event_day_id: eventDayId,
      });
      expect(undoErr).toBeNull();
      expect(undoData).toMatchObject({ success: true });

      const { data: dayAfter } = await supabase.from("event_days").select("status").eq("id", eventDayId).single();
      expect(dayAfter?.status).toBe("locked");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });
});
