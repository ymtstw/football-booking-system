import { describe, expect, it } from "vitest";

import { GET as getAvailability } from "@/app/api/event-days/[date]/availability/route";
import { POST as postReservation } from "@/app/api/reservations/route";
import { POST as postCancel } from "@/app/api/reservations/[token]/cancel/route";

import { ensureAtLeastOneActiveLunchMenuItem } from "./helpers/ensure-active-lunch-menu-item";
import {
  deleteEventDayById,
  insertEventDayWithSlots,
} from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const futureDeadlineIso = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

function validTeam(emailSuffix: string) {
  return {
    teamName: "契約確認チーム",
    strengthCategory: "strong" as const,
    representativeGradeYear: 3,
    contactName: "テスト代表",
    contactEmail: `contract-${emailSuffix}@example.test`,
    contactPhone: "09012345678",
  };
}

describe.skipIf(!hasSupabaseEnv())(
  "integration: 公開予約 API レスポンス形（セキュリティ契約）",
  () => {
    it("POST /api/reservations 201: token / display / publicRef のみ（reservationId・teamId・hash キーなし）", async () => {
      await ensureAtLeastOneActiveLunchMenuItem();
      const { eventDayId, morningSlotId, eventDate } = await insertEventDayWithSlots({
        status: "open",
        reservationDeadlineAtIso: futureDeadlineIso,
      });
      const supabase = getIntegrationSupabase();
      const { data: menuRows, error: menuErr } = await supabase
        .from("lunch_menu_items")
        .select("id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1);
      expect(menuErr).toBeNull();
      const menuId = menuRows?.[0]?.id as string | undefined;
      expect(menuId).toBeTruthy();

      try {
        const suffix = `${eventDayId.slice(0, 8)}-${Date.now()}`;
        const res = await postReservation(
          new Request("http://localhost/api/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventDayId,
              selectedMorningSlotId: morningSlotId,
              team: validTeam(suffix),
              participantCount: 2,
              lunchItems: [{ menuItemId: menuId!, quantity: 1 }],
            }),
          })
        );
        expect(res.status).toBe(201);
        const json = (await res.json()) as Record<string, unknown>;
        expect(typeof json.reservationToken).toBe("string");
        expect(String(json.reservationToken).length).toBeGreaterThan(0);
        expect(typeof json.reservationTokenDisplay).toBe("string");
        expect(typeof json.publicRef).toBe("string");
        expect(json).not.toHaveProperty("reservationId");
        expect(json).not.toHaveProperty("teamId");
        expect(json).not.toHaveProperty("reservation_token_hash");
        const raw = JSON.stringify(json);
        expect(raw.toLowerCase()).not.toContain("reservation_token_hash");

        /** invalid_input 相当: 存在しない昼食メニュー UUID → 400・detail なし */
        const badMenu = "00000000-0000-4000-8000-000000000099";
        const badRes = await postReservation(
          new Request("http://localhost/api/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventDayId,
              selectedMorningSlotId: morningSlotId,
              team: validTeam(`bad-${suffix}`),
              participantCount: 2,
              lunchItems: [{ menuItemId: badMenu, quantity: 1 }],
            }),
          })
        );
        expect(badRes.status).toBe(400);
        const badJson = (await badRes.json()) as Record<string, unknown>;
        expect(badJson.error).toBe("入力内容を確認してください");
        expect(badJson).not.toHaveProperty("detail");
        expect(JSON.stringify(badJson)).not.toContain("lunch_menu_invalid");
        expect(JSON.stringify(badJson)).not.toContain("token hash");

        /** cancel 成功: reservationId を返さない */
        const tokenPlain = String(json.reservationToken);
        const cancelRes = await postCancel(
          new Request(`http://localhost/api/reservations/${encodeURIComponent(tokenPlain)}/cancel`, {
            method: "POST",
          }),
          { params: Promise.resolve({ token: tokenPlain }) }
        );
        expect(cancelRes.status).toBe(200);
        const cancelJson = (await cancelRes.json()) as Record<string, unknown>;
        expect(cancelJson.cancelled).toBe(true);
        expect(cancelJson).not.toHaveProperty("reservationId");

        /** availability: bookedTeams に予約・チーム内部 ID が含まれない */
        const availRes = await getAvailability(
          new Request(`http://localhost/api/event-days/${encodeURIComponent(eventDate)}/availability`),
          { params: Promise.resolve({ date: eventDate }) }
        );
        expect(availRes.status).toBe(200);
        const availData = (await availRes.json()) as {
          morningSlots: Array<{ bookedTeams: Array<Record<string, unknown>> }>;
        };
        for (const slot of availData.morningSlots ?? []) {
          for (const bt of slot.bookedTeams ?? []) {
            expect(bt).not.toHaveProperty("reservationId");
            expect(bt).not.toHaveProperty("teamId");
          }
        }
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });
  }
);
