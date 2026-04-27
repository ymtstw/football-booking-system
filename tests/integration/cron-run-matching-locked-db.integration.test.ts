import { randomBytes } from "node:crypto";

import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";

import { GET as GET_MATCH } from "@/app/api/cron/run-matching-locked/route";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { applyMatchingForEventDayId } from "@/lib/matching/run-matching-for-event-day";

import { deleteAllEventDaysForIntegration } from "./helpers/delete-all-event-days";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { testReservationPublicRef } from "./helpers/test-reservation-public-ref";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const CRON_SECRET_TEST = "test-cron-secret-for-vitest-16";
const GRADE = "__integration_job02__";
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
    p_lunch_items: [] as unknown[],
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
    p_public_ref: testReservationPublicRef(),
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

function matchGet() {
  return GET_MATCH(
    new NextRequest("http://localhost/api/cron/run-matching-locked", {
      headers: { Authorization: `Bearer ${CRON_SECRET_TEST}` },
    })
  );
}

describe.skipIf(!hasSupabaseEnv())(
  "integration: GET /api/cron/run-matching-locked（RM-001/010/011/012）",
  () => {
    beforeAll(async () => {
      await deleteAllEventDaysForIntegration();
    });

    it("RM-001: Bearer 不一致 → 401", async () => {
      await withCronSecret(async () => {
        const res = await GET_MATCH(
          new NextRequest("http://localhost/api/cron/run-matching-locked", {
            headers: { Authorization: "Bearer wrong-secret-value-here" },
          })
        );
        expect(res.status).toBe(401);
      });
    });

    it("RM-010: locked かつ event_date < 東京今日のみのとき processed 0", async () => {
      const yesterday = addDaysIsoDate(tokyoIsoDateToday(), -1);
      const { eventDayId } = await insertEventDayWithSlots({
        status: "locked",
        reservationDeadlineAtIso: futureDeadlineIso,
        eventDate: yesterday,
        gradeBand: GRADE,
      });
      try {
        const res = await withCronSecret(() => matchGet());
        expect(res.status).toBe(200);
        const json = (await res.json()) as {
          ok?: boolean;
          processed?: number;
          results?: unknown[];
          todayTokyo?: string;
        };
        expect(json.ok).toBe(true);
        expect(json.processed).toBe(0);
        expect(json.results ?? []).toEqual([]);
        expect(json.todayTokyo).toBe(tokyoIsoDateToday());
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });

    it("RM-011: GET run-matching-locked で locked→confirmed・matchingRunId が返る", async () => {
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
          const tokenPlain = randomBytes(32).toString("hex");
          const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
          const { data, error } = await supabase.rpc(
            "create_public_reservation",
            baseCreateRpcParams(eventDayId, morningIds[i]!, tokenHash, `rm-${i}-${eventDayId.slice(0, 8)}`)
          );
          expect(error).toBeNull();
          expect(data).toMatchObject({ success: true });
        }

        const { error: lockErr } = await supabase
          .from("event_days")
          .update({ status: "locked" })
          .eq("id", eventDayId);
        expect(lockErr).toBeNull();

        const res1 = await withCronSecret(() => matchGet());
        expect(res1.status).toBe(200);
        const j1 = (await res1.json()) as {
          ok?: boolean;
          results?: Array<{
            eventDayId: string;
            ok: boolean;
            matchingRunId?: string;
            assignmentCount?: number;
            skipped?: string;
            error?: string;
          }>;
        };
        expect(j1.ok).toBe(true);
        const row1 = j1.results?.find((r) => r.eventDayId === eventDayId);
        expect(row1?.ok).toBe(true);
        expect(row1?.matchingRunId).toBeTruthy();
        expect((row1?.assignmentCount ?? 0) > 0).toBe(true);
        expect(row1?.skipped).toBeUndefined();

        const { data: st1 } = await supabase.from("event_days").select("status").eq("id", eventDayId).single();
        expect(st1?.status).toBe("confirmed");
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });

    it("RM-012: afternoon_auto 既存かつ locked に戻した不整合時、applyMatchingForEventDayId は already_matched", async () => {
      const eventDate = addDaysIsoDate(tokyoIsoDateToday(), 5);
      const { eventDayId } = await insertEventDayWithSlots({
        status: "open",
        reservationDeadlineAtIso: futureDeadlineIso,
        eventDate,
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

        for (let i = 0; i < 3; i++) {
          const tokenPlain = randomBytes(32).toString("hex");
          const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
          const { data, error } = await supabase.rpc(
            "create_public_reservation",
            baseCreateRpcParams(eventDayId, morningIds[i]!, tokenHash, `rm12-${i}-${eventDayId.slice(0, 8)}`)
          );
          expect(error).toBeNull();
          expect(data).toMatchObject({ success: true });
        }

        await supabase.from("event_days").update({ status: "locked" }).eq("id", eventDayId);

        const first = await applyMatchingForEventDayId(supabase, eventDayId);
        expect(first.ok).toBe(true);

        await supabase.from("event_days").update({ status: "locked" }).eq("id", eventDayId);

        const second = await applyMatchingForEventDayId(supabase, eventDayId);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          expect(second.error).toBe("already_matched");
        }
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });
  }
);
