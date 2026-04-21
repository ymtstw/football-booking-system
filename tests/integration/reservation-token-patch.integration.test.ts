import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PATCH } from "@/app/api/reservations/[token]/route";

import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";

const futureDeadlineIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

describe.skipIf(!hasSupabaseEnv())("integration: PATCH /api/reservations/[token]（TK-002）", () => {
  it("締切後 PATCH は 409・participant_count 等は不変", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    try {
      const supabase = getIntegrationSupabase();
      const tokenPlain = randomBytes(32).toString("hex");
      const tokenHash = hashReservationTokenPlainForTest(tokenPlain);

      const { data: created, error: cErr } = await supabase.rpc("create_public_reservation", {
        p_event_day_id: eventDayId,
        p_selected_morning_slot_id: morningSlotId,
        p_team_name: "PATCH結合チーム",
        p_strength_category: "strong",
        p_contact_name: "テスト太郎",
        p_contact_email: `tk2-${eventDayId.slice(0, 8)}@example.test`,
        p_contact_phone: "09012345678",
        p_participant_count: 8,
        p_lunch_items: [],
        p_remarks: "",
        p_token_hash: tokenHash,
        p_representative_grade_year: 3,
      });
      expect(cErr).toBeNull();
      expect(created).toMatchObject({ success: true });

      const { data: resRow } = await supabase
        .from("reservations")
        .select("id, participant_count")
        .eq("reservation_token_hash", tokenHash)
        .single();
      expect(resRow?.participant_count).toBe(8);

      const { error: pastErr } = await supabase
        .from("event_days")
        .update({ reservation_deadline_at: "2000-01-01T00:00:00.000Z" })
        .eq("id", eventDayId);
      expect(pastErr).toBeNull();

      const res = await PATCH(
        new Request(`http://localhost/api/x/${encodeURIComponent(tokenPlain)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantCount: 5,
            lunchItems: [],
            contactName: "変更後",
            contactPhone: "08011112222",
          }),
        }),
        { params: Promise.resolve({ token: tokenPlain }) }
      );
      expect(res.status).toBe(409);

      const { data: after } = await supabase
        .from("reservations")
        .select("participant_count")
        .eq("id", resRow!.id as string)
        .single();
      expect(after?.participant_count).toBe(8);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });
});
