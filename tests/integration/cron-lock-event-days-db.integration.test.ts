import { randomBytes } from "node:crypto";

import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/cron/lock-event-days/route";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";

import { deleteAllEventDaysForIntegration } from "./helpers/delete-all-event-days";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const CRON_SECRET_TEST = "test-cron-secret-for-vitest-16";
const GRADE = "__integration_cron_lock__";
const pastDeadlineIso = "2000-01-01T00:00:00.000Z";
const futureDeadlineIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

function baseCreateRpcParams(
  eventDayId: string,
  morningSlotId: string,
  tokenHash: string,
  emailLocal: string
) {
  return {
    p_event_day_id: eventDayId,
    p_selected_morning_slot_id: morningSlotId,
    p_team_name: "結合テストチーム",
    p_strength_category: "strong",
    p_contact_name: "テスト太郎",
    p_contact_email: `${emailLocal}@example.test`,
    p_contact_phone: "09012345678",
    p_participant_count: 8,
    p_lunch_items: [],
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
  };
}

async function withCronSecret<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = CRON_SECRET_TEST;
  try {
    return await fn();
  } finally {
    if (prev !== undefined) process.env.CRON_SECRET = prev;
    else delete process.env.CRON_SECRET;
  }
}

function lockGet() {
  return GET(
    new NextRequest("http://localhost/api/cron/lock-event-days", {
      headers: { Authorization: `Bearer ${CRON_SECRET_TEST}` },
    })
  );
}

describe.skipIf(!hasSupabaseEnv())("integration: GET /api/cron/lock-event-days（DB・CK-003/010/011/012/021）", () => {
  beforeAll(async () => {
    await deleteAllEventDaysForIntegration();
  });

  it("CK-003: open かつ締切未到来のみのときは配列空で成功し、行は open のまま（CK-010）", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      eventDate: "2099-03-15",
      gradeBand: GRADE,
    });
    try {
      const res = await withCronSecret(() => lockGet());
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        ok?: boolean;
        lockedCount?: number;
        minimumCancelledCount?: number;
        lockedIds?: string[];
        minimumCancelledIds?: string[];
      };
      expect(json.ok).toBe(true);
      expect(json.lockedCount).toBe(0);
      expect(json.minimumCancelledCount).toBe(0);
      expect(json.lockedIds ?? []).toEqual([]);
      expect(json.minimumCancelledIds ?? []).toEqual([]);

      const supabase = getIntegrationSupabase();
      const { data: row } = await supabase.from("event_days").select("status").eq("id", eventDayId).single();
      expect(row?.status).toBe("open");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("CK-012 + CK-021: 締切後・active>=3 → locked のあと 2 回目 Cron は新規ロックなし（冪等）", async () => {
    const todayTokyo = tokyoIsoDateToday();
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      eventDate: todayTokyo,
      gradeBand: GRADE,
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
      expect(morningIds.length).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < 3; i++) {
        const tokenHash = hashReservationTokenPlainForTest(randomBytes(32).toString("hex"));
        const { data, error } = await supabase.rpc(
          "create_public_reservation",
          baseCreateRpcParams(eventDayId, morningIds[i]!, tokenHash, `ck12-${i}-${eventDayId.slice(0, 8)}`)
        );
        expect(error).toBeNull();
        expect(data).toMatchObject({ success: true });
      }

      const { error: pastDlErr } = await supabase
        .from("event_days")
        .update({ reservation_deadline_at: pastDeadlineIso })
        .eq("id", eventDayId);
      expect(pastDlErr).toBeNull();

      const res1 = await withCronSecret(() => lockGet());
      expect(res1.status).toBe(200);
      const j1 = (await res1.json()) as { lockedIds?: string[]; minimumCancelledIds?: string[] };
      expect(j1.lockedIds).toContain(eventDayId);
      expect(j1.minimumCancelledIds ?? []).toEqual([]);

      const { data: day1 } = await supabase.from("event_days").select("status").eq("id", eventDayId).single();
      expect(day1?.status).toBe("locked");

      const res2 = await withCronSecret(() => lockGet());
      expect(res2.status).toBe(200);
      const j2 = (await res2.json()) as {
        lockedCount?: number;
        minimumCancelledCount?: number;
        lockedIds?: string[];
        minimumCancelledIds?: string[];
      };
      expect(j2.lockedCount).toBe(0);
      expect(j2.minimumCancelledCount).toBe(0);
      expect(j2.lockedIds ?? []).toEqual([]);
      expect(j2.minimumCancelledIds ?? []).toEqual([]);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("CK-011: 締切後・active<3 → cancelled_minimum", async () => {
    const eventDate = addDaysIsoDate(tokyoIsoDateToday(), 1);
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      eventDate,
      gradeBand: GRADE,
    });
    try {
      const supabase = getIntegrationSupabase();
      for (let i = 0; i < 2; i++) {
        const tokenHash = hashReservationTokenPlainForTest(randomBytes(32).toString("hex"));
        const { data, error } = await supabase.rpc(
          "create_public_reservation",
          baseCreateRpcParams(eventDayId, morningSlotId, tokenHash, `ck11-${i}-${eventDayId.slice(0, 8)}`)
        );
        expect(error).toBeNull();
        expect(data).toMatchObject({ success: true });
      }

      const { error: pastDlErr } = await supabase
        .from("event_days")
        .update({ reservation_deadline_at: pastDeadlineIso })
        .eq("id", eventDayId);
      expect(pastDlErr).toBeNull();

      const res = await withCronSecret(() => lockGet());
      expect(res.status).toBe(200);
      const json = (await res.json()) as { minimumCancelledIds?: string[]; lockedIds?: string[] };
      expect(json.minimumCancelledIds).toContain(eventDayId);
      expect(json.lockedIds ?? []).toEqual([]);

      const { data: day } = await supabase.from("event_days").select("status").eq("id", eventDayId).single();
      expect(day?.status).toBe("cancelled_minimum");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });
});
