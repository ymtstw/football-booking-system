import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";

const { applyMock } = vi.hoisted(() => ({
  applyMock: vi.fn(),
}));

vi.mock("@/lib/matching/run-matching-for-event-day", () => ({
  applyMatchingForEventDayId: (supabase: unknown, eventDayId: string) =>
    applyMock(supabase, eventDayId),
}));

import { GET as GET_RUN_MATCHING_LOCKED } from "@/app/api/cron/run-matching-locked/route";

import { deleteAllEventDaysForIntegration } from "./helpers/delete-all-event-days";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { hasSupabaseEnv } from "./helpers/service-role-client";

const CRON_SECRET_TEST = "test-cron-secret-for-vitest-16";
const GRADE = "__integration_rm013_cron__";
const futureDeadlineIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

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

describe.skipIf(!hasSupabaseEnv())(
  "integration: GET /api/cron/run-matching-locked（RM-013 失敗可視化）",
  () => {
    beforeEach(async () => {
      applyMock.mockReset();
      await deleteAllEventDaysForIntegration();
    });

    it("applyMatching が unknown 失敗のとき results に ok:false と error（メッセージ）が載る", async () => {
      applyMock.mockResolvedValue({
        ok: false,
        error: "unknown",
        message: "RM013_SIMULATED_FAILURE",
      });

      const todayTokyo = tokyoIsoDateToday();
      const { eventDayId } = await insertEventDayWithSlots({
        status: "locked",
        reservationDeadlineAtIso: futureDeadlineIso,
        eventDate: todayTokyo,
        gradeBand: GRADE,
      });
      try {
        const res = await withCronSecret(async () =>
          GET_RUN_MATCHING_LOCKED(
            new NextRequest("http://localhost/api/cron/run-matching-locked", {
              headers: { Authorization: `Bearer ${CRON_SECRET_TEST}` },
            })
          )
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          ok?: boolean;
          results?: Array<{ eventDayId: string; ok: boolean; error?: string; skipped?: string }>;
        };
        expect(body.ok).toBe(true);
        const row = body.results?.find((r) => r.eventDayId === eventDayId);
        expect(row?.ok).toBe(false);
        expect(row?.error).toBe("RM013_SIMULATED_FAILURE");
        expect(row?.skipped).toBeUndefined();
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });
  }
);
