import { randomBytes } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

import { GET as GET_SEND_MATCHING_PROPOSAL } from "@/app/api/cron/send-matching-proposal/route";
import { TEMPLATE_MATCHING_PROPOSAL } from "@/lib/email/matching-proposal-mail";

import { deleteAllEventDaysForIntegration } from "./helpers/delete-all-event-days";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { testReservationPublicRef } from "./helpers/test-reservation-public-ref";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

const CRON_SECRET_TEST = "test-cron-secret-for-vitest-16";
const GRADE = "__integration_matching_proposal_cron__";
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
    p_strength_category: "strong" as const,
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

async function withResendEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.RESEND_FROM;
  process.env.RESEND_API_KEY = "re_integration_test_dummy_key";
  process.env.RESEND_FROM = "noreply@test.local";
  try {
    return await fn();
  } finally {
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
    else delete process.env.RESEND_API_KEY;
    if (prevFrom !== undefined) process.env.RESEND_FROM = prevFrom;
    else delete process.env.RESEND_FROM;
  }
}

describe("integration: GET /api/cron/send-matching-proposal（認証）", () => {
  it("CRON_SECRET 未設定 → 503", async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const req = new NextRequest("http://localhost/api/cron/send-matching-proposal");
      const res = await GET_SEND_MATCHING_PROPOSAL(req);
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toMatch(/CRON_SECRET/);
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev;
      else delete process.env.CRON_SECRET;
    }
  });

  it("CRON_SECRET あり・Bearer 不一致 → 401", async () => {
    await withCronSecret(async () => {
      const req = new NextRequest("http://localhost/api/cron/send-matching-proposal", {
        headers: { Authorization: "Bearer wrong-secret-value-here" },
      });
      const res = await GET_SEND_MATCHING_PROPOSAL(req);
      expect(res.status).toBe(401);
    });
  });
});

describe.skipIf(!hasSupabaseEnv())(
  "integration: GET /api/cron/send-matching-proposal（DB + Resend モック）",
  () => {
    beforeAll(async () => {
      await deleteAllEventDaysForIntegration();
    });

    beforeEach(async () => {
      resendSendMock.mockReset();
      await deleteAllEventDaysForIntegration();
    });

    it("TC-EX-CR-MP-06: 送信成功後 notifications.status が sent", async () => {
      resendSendMock.mockResolvedValue({ data: { id: "fake-email-id" }, error: null });
      const targetEventDate = addDaysIsoDate(tokyoIsoDateToday(), 2);

      const { eventDayId } = await insertEventDayWithSlots({
        status: "open",
        reservationDeadlineAtIso: futureDeadlineIso,
        eventDate: targetEventDate,
        gradeBand: GRADE,
      });
      try {
        const supabase = getIntegrationSupabase();
        const { data: morningSlot, error: mErr } = await supabase
          .from("event_day_slots")
          .select("id")
          .eq("event_day_id", eventDayId)
          .eq("phase", "morning")
          .eq("is_active", true)
          .order("slot_code", { ascending: true })
          .limit(1)
          .maybeSingle();
        expect(mErr).toBeNull();
        expect(morningSlot?.id).toBeTruthy();

        const tokenPlain = randomBytes(32).toString("hex");
        const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
        const { data: created, error: cErr } = await supabase.rpc("create_public_reservation", {
          ...baseCreateRpcParams(eventDayId, morningSlot!.id as string, tokenHash, `mp06-${eventDayId.slice(0, 8)}`),
        });
        expect(cErr).toBeNull();
        expect(created).toMatchObject({ success: true });

        const { error: lockErr } = await supabase
          .from("event_days")
          .update({ status: "locked" })
          .eq("id", eventDayId);
        expect(lockErr).toBeNull();

        const res = await withResendEnv(() =>
          withCronSecret(async () =>
            GET_SEND_MATCHING_PROPOSAL(
              new NextRequest("http://localhost/api/cron/send-matching-proposal", {
                headers: { Authorization: `Bearer ${CRON_SECRET_TEST}` },
              })
            )
          )
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok?: boolean; summary?: { sent: number }[] };
        expect(body.ok).toBe(true);
        expect((body.summary?.[0]?.sent ?? 0) >= 1).toBe(true);

        const { data: resRow } = await supabase
          .from("reservations")
          .select("id")
          .eq("event_day_id", eventDayId)
          .eq("status", "active")
          .maybeSingle();
        expect(resRow?.id).toBeTruthy();

        const { data: notif } = await supabase
          .from("notifications")
          .select("status")
          .eq("reservation_id", resRow!.id as string)
          .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
          .maybeSingle();
        expect(notif?.status).toBe("sent");

        const { data: dayRow } = await supabase
          .from("event_days")
          .select("matching_proposal_notice_sent_at")
          .eq("id", eventDayId)
          .single();
        expect(dayRow?.matching_proposal_notice_sent_at).toBeTruthy();
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });

    it("TC-EX-CR-MP-07: Resend エラー時 notifications.status が failed", async () => {
      resendSendMock.mockResolvedValue({
        data: null,
        error: { message: "Resend API error (integration test)" },
      });
      const targetEventDate = addDaysIsoDate(tokyoIsoDateToday(), 2);

      const { eventDayId } = await insertEventDayWithSlots({
        status: "open",
        reservationDeadlineAtIso: futureDeadlineIso,
        eventDate: targetEventDate,
        gradeBand: GRADE,
      });
      try {
        const supabase = getIntegrationSupabase();
        const { data: morningSlot, error: mErr } = await supabase
          .from("event_day_slots")
          .select("id")
          .eq("event_day_id", eventDayId)
          .eq("phase", "morning")
          .eq("is_active", true)
          .order("slot_code", { ascending: true })
          .limit(1)
          .maybeSingle();
        expect(mErr).toBeNull();

        const tokenPlain = randomBytes(32).toString("hex");
        const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
        const { error: cErr } = await supabase.rpc("create_public_reservation", {
          ...baseCreateRpcParams(eventDayId, morningSlot!.id as string, tokenHash, `mp07-${eventDayId.slice(0, 8)}`),
        });
        expect(cErr).toBeNull();

        const { error: lockErr } = await supabase
          .from("event_days")
          .update({ status: "locked" })
          .eq("id", eventDayId);
        expect(lockErr).toBeNull();

        const res = await withResendEnv(() =>
          withCronSecret(async () =>
            GET_SEND_MATCHING_PROPOSAL(
              new NextRequest("http://localhost/api/cron/send-matching-proposal", {
                headers: { Authorization: `Bearer ${CRON_SECRET_TEST}` },
              })
            )
          )
        );
        expect(res.status).toBe(200);

        const { data: resRow } = await supabase
          .from("reservations")
          .select("id")
          .eq("event_day_id", eventDayId)
          .eq("status", "active")
          .maybeSingle();

        const { data: notif } = await supabase
          .from("notifications")
          .select("status")
          .eq("reservation_id", resRow!.id as string)
          .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
          .maybeSingle();
        expect(notif?.status).toBe("failed");
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });
  }
);
