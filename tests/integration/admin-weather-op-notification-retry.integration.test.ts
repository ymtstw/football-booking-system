import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TEMPLATE_MATCHING_PROPOSAL } from "@/lib/email/matching-proposal-mail";

import { deleteAllEventDaysForIntegration } from "./helpers/delete-all-event-days";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

import type { User } from "@supabase/supabase-js";

const { resendSendMock, adminUserMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(),
  adminUserMock: vi.fn<[], Promise<User | null>>().mockResolvedValue(null),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

vi.mock("@/lib/auth/require-admin", () => ({
  getAdminUser: () => adminUserMock() as Promise<User | null>,
}));

import { POST as postWeatherDecision } from "@/app/api/admin/event-days/[id]/weather-decision/route";
import { POST as postOperationalCancel } from "@/app/api/admin/event-days/[id]/operational-cancel/route";
import { POST as postNotificationRetry } from "@/app/api/admin/notifications/[id]/retry/route";

const GRADE = "__integration_admin_mvp__";
const futureDeadlineIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
let testAdminId: string;
let testAdminUser: User;

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/placeholder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseCreateRpc(
  eventDayId: string,
  morningSlotId: string,
  tokenHash: string,
  emailKey: string
) {
  return {
    p_event_day_id: eventDayId,
    p_selected_morning_slot_id: morningSlotId,
    p_team_name: "結合テストチーム",
    p_strength_category: "strong" as const,
    p_contact_name: "テスト",
    p_contact_email: `mvp-${emailKey}@example.test`,
    p_contact_phone: "09000000000",
    p_participant_count: 8,
    p_lunch_items: [] as unknown[],
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
  };
}

async function withResendEnv<T>(fn: () => Promise<T>): Promise<T> {
  const k = process.env.RESEND_API_KEY;
  const f = process.env.RESEND_FROM;
  process.env.RESEND_API_KEY = "re_mvp_int_dummy";
  process.env.RESEND_FROM = "mvp@test.local";
  try {
    return await fn();
  } finally {
    if (k !== undefined) process.env.RESEND_API_KEY = k;
    else delete process.env.RESEND_API_KEY;
    if (f !== undefined) process.env.RESEND_FROM = f;
    else delete process.env.RESEND_FROM;
  }
}

describe.skipIf(!hasSupabaseEnv())("integration: 管理 API ― 天候・運営中止・通知再送", () => {
  beforeAll(async () => {
    const supa = getIntegrationSupabase();
    const { data, error } = await supa.auth.admin.createUser({
      email: `admin-mvp-${Date.now()}-${randomBytes(4).toString("hex")}@test.local`,
      password: "TestPassword-123456",
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("auth.admin.createUser が失敗");
    }
    testAdminId = data.user.id;
    testAdminUser = data.user as User;
    adminUserMock.mockReset();
    adminUserMock.mockImplementation(async () => testAdminUser);
  }, 30_000);

  afterAll(async () => {
    if (!testAdminId) return;
    const supa = getIntegrationSupabase();
    const { error } = await supa.auth.admin.deleteUser(testAdminId);
    if (error) console.warn("admin テストユーザー削除失敗", error.message);
  });

  beforeEach(async () => {
    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: "e-mvp" }, error: null });
    await deleteAllEventDaysForIntegration();
  });

  it("TC-EX-WX-200GO: go で weather_status が go", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "locked",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    try {
      const res = await postWeatherDecision(jsonReq({ decision: "go", notes: "int-go" }), {
        params: Promise.resolve({ id: eventDayId }),
      });
      expect(res.status).toBe(200);
      const supa = getIntegrationSupabase();
      const { data: ed } = await supa
        .from("event_days")
        .select("weather_status, status")
        .eq("id", eventDayId)
        .single();
      expect(ed?.weather_status).toBe("go");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("TC-EX-WX-200CDB: cancel + day_before_17 で前日 17 時用フラグ", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "confirmed",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    try {
      const res = await postWeatherDecision(
        jsonReq({ decision: "cancel", delivery: "day_before_17", notes: "cdb" }),
        { params: Promise.resolve({ id: eventDayId }) }
      );
      expect(res.status).toBe(200);
      const supa = getIntegrationSupabase();
      const { data: ed } = await supa
        .from("event_days")
        .select("weather_day_before_rain_scheduled, weather_status, status")
        .eq("id", eventDayId)
        .single();
      expect(ed?.weather_day_before_rain_scheduled).toBe(true);
      expect(ed?.weather_status).toBe("go");
      expect(ed?.status).toBe("confirmed");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("TC-EX-WX-200CIM: cancel immediate + 即時メール（Resend モック）", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    const supa = getIntegrationSupabase();
    const { data: slot, error: sErr } = await supa
      .from("event_day_slots")
      .select("id")
      .eq("event_day_id", eventDayId)
      .eq("phase", "morning")
      .eq("is_active", true)
      .order("slot_code", { ascending: true })
      .limit(1)
      .maybeSingle();
    expect(sErr).toBeNull();
    const h = hashReservationTokenPlainForTest(randomBytes(32).toString("hex"));
    const { error: rErr } = await supa.rpc("create_public_reservation", {
      ...baseCreateRpc(eventDayId, slot!.id as string, h, "wxcim"),
    });
    expect(rErr).toBeNull();
    const { error: cErr } = await supa.from("event_days").update({ status: "confirmed" }).eq("id", eventDayId);
    expect(cErr).toBeNull();
    try {
      const res = await withResendEnv(() =>
        postWeatherDecision(
          jsonReq({
            decision: "cancel",
            delivery: "immediate",
            sendImmediateCancelNotice: true,
            notes: "im",
          }),
          { params: Promise.resolve({ id: eventDayId }) }
        )
      );
      expect(res.status).toBe(200);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("TC-EX-OP-200: 運営中止（即時通知なし）", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "locked",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    try {
      const res = await postOperationalCancel(
        jsonReq({ participantNotice: "運用テスト中止", sendImmediateOperationalNotice: false }),
        { params: Promise.resolve({ id: eventDayId }) }
      );
      expect(res.status).toBe(200);
      const j = (await res.json()) as { ok?: boolean };
      expect(j.ok).toBe(true);
      const { data: ed } = await getIntegrationSupabase()
        .from("event_days")
        .select("status, operational_cancellation_notice")
        .eq("id", eventDayId)
        .single();
      expect(ed?.status).toBe("cancelled_operational");
      expect((ed?.operational_cancellation_notice as string) ?? "").toContain("運用テスト中止");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("TC-EX-OP-200IM: 即時通知（Resend モック）", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    const supa = getIntegrationSupabase();
    const { data: slot, error: sErr } = await supa
      .from("event_day_slots")
      .select("id")
      .eq("event_day_id", eventDayId)
      .eq("phase", "morning")
      .eq("is_active", true)
      .order("slot_code", { ascending: true })
      .limit(1)
      .maybeSingle();
    expect(sErr).toBeNull();
    const h = hashReservationTokenPlainForTest(randomBytes(32).toString("hex"));
    const { error: rErr } = await supa.rpc("create_public_reservation", {
      ...baseCreateRpc(eventDayId, slot!.id as string, h, "opim"),
    });
    expect(rErr).toBeNull();
    await supa.from("event_days").update({ status: "confirmed" }).eq("id", eventDayId);
    try {
      const res = await withResendEnv(() =>
        postOperationalCancel(
          jsonReq({
            participantNotice: "即時開催中止のお知らせ",
            sendImmediateOperationalNotice: true,
          }),
          { params: Promise.resolve({ id: eventDayId }) }
        )
      );
      expect(res.status).toBe(200);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("NF-001 / TC-EX-NR-200S: failed 通知の再送（POST retry・sent）", async () => {
    const { eventDayId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    const supa = getIntegrationSupabase();
    const { data: slot, error: sErr } = await supa
      .from("event_day_slots")
      .select("id")
      .eq("event_day_id", eventDayId)
      .eq("phase", "morning")
      .eq("is_active", true)
      .order("slot_code", { ascending: true })
      .limit(1)
      .maybeSingle();
    expect(sErr).toBeNull();
    const h = hashReservationTokenPlainForTest(randomBytes(32).toString("hex"));
    const { data: cData, error: rErr } = await supa.rpc("create_public_reservation", {
      ...baseCreateRpc(eventDayId, slot!.id as string, h, "retry"),
    });
    expect(rErr).toBeNull();
    expect(cData).toMatchObject({ success: true });
    const { data: rRow, error: qe } = await supa
      .from("reservations")
      .select("id")
      .eq("event_day_id", eventDayId)
      .eq("reservation_token_hash", h)
      .maybeSingle();
    expect(qe).toBeNull();
    const reservationId = rRow?.id as string;
    expect(reservationId).toBeTruthy();

    const { data: nIns, error: nErr } = await supa
      .from("notifications")
      .insert({
        event_day_id: eventDayId,
        reservation_id: reservationId,
        channel: "email",
        status: "failed",
        template_key: TEMPLATE_MATCHING_PROPOSAL,
        payload_summary: { event_date: "2000-01-01" },
        error_message: "mock failed for retry",
      })
      .select("id")
      .single();
    expect(nErr).toBeNull();
    const notifId = nIns!.id as string;

    try {
      const res = await withResendEnv(() =>
        postNotificationRetry(new Request("http://localhost/ignore"), {
          params: Promise.resolve({ id: notifId }),
        })
      );
      expect(res.status).toBe(200);
      const j = (await res.json()) as { ok?: boolean; status?: string };
      expect(j.ok).toBe(true);
      expect(j.status).toBe("sent");
      const { data: nAfter } = await supa
        .from("notifications")
        .select("status")
        .eq("id", notifId)
        .single();
      expect(nAfter?.status).toBe("sent");
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("未認証は 401（天候 POST）", async () => {
    adminUserMock.mockImplementationOnce(async () => null);
    const { eventDayId } = await insertEventDayWithSlots({
      status: "locked",
      reservationDeadlineAtIso: futureDeadlineIso,
      gradeBand: GRADE,
    });
    try {
      const res = await postWeatherDecision(jsonReq({ decision: "go" }), {
        params: Promise.resolve({ id: eventDayId }),
      });
      expect(res.status).toBe(401);
    } finally {
      adminUserMock.mockReset();
      adminUserMock.mockImplementation(async () => testAdminUser);
      await deleteEventDayById(eventDayId);
    }
  });
});
