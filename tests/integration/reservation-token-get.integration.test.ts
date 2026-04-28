import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@supabase/supabase-js";

import { RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA } from "@/lib/reservations/reservation-token-auth-message";

const { sendCancelMailMock, resendSendMock, adminUserMock, RESEND_TEST_SECOND_TOKEN } = vi.hoisted(
  () => ({
    sendCancelMailMock: vi.fn().mockResolvedValue(undefined),
    resendSendMock: vi.fn().mockResolvedValue({ data: { id: "re_integration_test" }, error: null }),
    adminUserMock: vi.fn(),
    RESEND_TEST_SECOND_TOKEN: "JKMNPQRSTVWXYZ98",
  })
);

vi.mock("@/lib/email/reservation-user-cancel-mail", () => ({
  sendReservationUserCancelledEmail: sendCancelMailMock,
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

vi.mock("@/lib/auth/require-admin", () => ({
  getAdminUser: async () => adminUserMock(),
}));

/** 管理再送が生成する確認コードを固定し、GET で新コード有効を検証する */
vi.mock("@/lib/reservations/confirmation-code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reservations/confirmation-code")>();
  return {
    ...actual,
    generateReservationConfirmationRaw: vi.fn(() => RESEND_TEST_SECOND_TOKEN),
  };
});

import { POST as POST_RESEND } from "@/app/api/admin/reservations/[id]/resend-created-email/route";
import { GET } from "@/app/api/reservations/[token]/route";
import { POST as POST_CANCEL } from "@/app/api/reservations/[token]/cancel/route";
import { formatReservationConfirmationDisplay } from "@/lib/reservations/confirmation-code";

import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";
import { hashReservationTokenPlainForTest } from "./helpers/hash-reservation-token";
import { testReservationPublicRef } from "./helpers/test-reservation-public-ref";

/** 接続先に `reservations.public_ref` 列があるか（マイグレーション適用済みか） */
let integrationHasReservationsPublicRef = false;
/** 列プローブ失敗時のメッセージ（厳格モードのエラー文面用） */
let integrationPublicRefProbeMessage: string | null = null;
if (hasSupabaseEnv()) {
  const supabase = getIntegrationSupabase();
  const { error } = await supabase.from("reservations").select("public_ref").limit(1);
  integrationHasReservationsPublicRef = !error;
  if (error) {
    integrationPublicRefProbeMessage = [error.code, error.message].filter(Boolean).join(": ");
  }
}

/** CI（GitHub Actions 等）または明示指定時は列欠如をスキップせず失敗させる */
function isCiOrStrictIntegrationSchema(): boolean {
  const ci = process.env.CI;
  if (ci === "true" || ci === "1") return true;
  const s = process.env.INTEGRATION_STRICT_SCHEMA?.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

if (
  hasSupabaseEnv() &&
  !integrationHasReservationsPublicRef &&
  isCiOrStrictIntegrationSchema()
) {
  throw new Error(
    [
      "結合テスト「GET /api/reservations/[token] 確認コード」には reservations.public_ref が必須ですが、接続先 DB で列を確認できませんでした。",
      integrationPublicRefProbeMessage ? `(${integrationPublicRefProbeMessage})` : "",
      "マイグレーション（例: 20260527120000_reservations_public_ref.sql）を適用してください。",
      "staging など CI 以外で厳格にしたい場合は INTEGRATION_STRICT_SCHEMA=1 を設定してください。",
    ].join(" ")
  );
}

const futureDeadlineIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

/** 許容アルファベットのみ・16 文字（テスト固定） */
const NEW_TOKEN_RAW = "23456789ABCDEFGH";

/** `NEW_TOKEN_RAW` と別コード（token_hash UNIQUE のためキャンセル・再送系は専用トークンを使う） */
const CANCEL_MAIL_TEST_TOKEN_RAW = "5566778899ABCDEF";
const RESEND_ROTATION_FIRST_TOKEN_RAW = "66778899ABCDEFGH";

function reservationIdFromCreateRpcPayload(data: unknown): string {
  expect(data && typeof data === "object").toBe(true);
  const o = data as Record<string, unknown>;
  expect(o.success).toBe(true);
  const id = o.reservationId ?? o.reservation_id;
  expect(typeof id === "string" && id.length > 0).toBe(true);
  return id;
}

function baseCreateRpc(
  eventDayId: string,
  morningSlotId: string,
  tokenHash: string,
  emailLocal: string,
  publicRef: string
) {
  return {
    p_event_day_id: eventDayId,
    p_selected_morning_slot_id: morningSlotId,
    p_team_name: "GET結合チーム",
    p_strength_category: "strong" as const,
    p_contact_name: "テスト太郎",
    p_contact_email: `${emailLocal}@example.test`,
    p_contact_phone: "09012345678",
    p_participant_count: 8,
    p_lunch_items: [] as unknown[],
    p_remarks: "",
    p_token_hash: tokenHash,
    p_representative_grade_year: 3,
    p_public_ref: publicRef,
  };
}

async function getJson(
  token: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const hdr = new Headers(headers);
  const res = await GET(
    new Request(`http://localhost/api/reservations/${encodeURIComponent(token)}`, { headers: hdr }),
    { params: Promise.resolve({ token }) }
  );
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function withResendEnv<T>(fn: () => Promise<T>): Promise<T> {
  const k = process.env.RESEND_API_KEY;
  const f = process.env.RESEND_FROM;
  process.env.RESEND_API_KEY = "re_integration_dummy";
  process.env.RESEND_FROM = "integration@test.local";
  try {
    return await fn();
  } finally {
    if (k !== undefined) process.env.RESEND_API_KEY = k;
    else delete process.env.RESEND_API_KEY;
    if (f !== undefined) process.env.RESEND_FROM = f;
    else delete process.env.RESEND_FROM;
  }
}

describe.skipIf(!hasSupabaseEnv() || !integrationHasReservationsPublicRef)(
  "integration: GET /api/reservations/[token] 確認コード",
  () => {
  beforeEach(() => {
    sendCancelMailMock.mockClear();
    resendSendMock.mockClear();
    adminUserMock.mockReset();
  });

  it("新形式コードで予約詳細を取得できる", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenHash = hashReservationTokenPlainForTest(NEW_TOKEN_RAW);
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, `get-new-${eventDayId.slice(0, 8)}`, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const { status, body } = await getJson(NEW_TOKEN_RAW);
      expect(status).toBe(200);
      expect(body.reservation).toBeTruthy();
      expect((body.reservation as { publicRef?: string }).publicRef).toBe(publicRef);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("ハイフンなし・小文字・空白入りでも取得できる", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenHash = hashReservationTokenPlainForTest(NEW_TOKEN_RAW);
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, `get-var-${eventDayId.slice(0, 8)}`, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const display = formatReservationConfirmationDisplay(NEW_TOKEN_RAW);
      const { status: s1 } = await getJson(display.replace(/-/g, ""));
      expect(s1).toBe(200);

      const { status: s2 } = await getJson(NEW_TOKEN_RAW.toLowerCase());
      expect(s2).toBe(200);

      const { status: s3 } = await getJson(`  ${display.slice(0, 4)}  -  ${display.slice(5)}  `);
      expect(s3).toBe(200);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("旧64hexコードでも既存予約を取得できる", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenPlain = randomBytes(32).toString("hex");
    const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, `get-hex-${eventDayId.slice(0, 8)}`, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const { status, body } = await getJson(tokenPlain.toUpperCase());
      expect(status).toBe(200);
      expect(body.reservation).toBeTruthy();
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("不正形式・存在しないコードは同一メッセージで失敗する", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenHash = hashReservationTokenPlainForTest(NEW_TOKEN_RAW);
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, `get-err-${eventDayId.slice(0, 8)}`, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const { status: badFmt, body: b1 } = await getJson("!!!not-a-valid-code!!!");
      expect(badFmt).toBe(404);
      expect(b1.error).toBe(RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA);

      const ghost = "23456789ABCDEFGJ";
      const ghostHash = hashReservationTokenPlainForTest(ghost);
      expect(ghostHash).not.toBe(tokenHash);
      const { status: nf, body: b2 } = await getJson(ghost);
      expect(nf).toBe(404);
      expect(b2.error).toBe(RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("public_ref だけでは予約詳細を取得できない", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenHash = hashReservationTokenPlainForTest(NEW_TOKEN_RAW);
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, `get-ref-${eventDayId.slice(0, 8)}`, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const { status, body } = await getJson(publicRef);
      expect(status).toBe(404);
      expect(body.error).toBe(RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA);
      expect(body.reservation).toBeFalsy();
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("失敗が閾値を超えると 429 になる（同一 X-Forwarded-For）", async () => {
    const octet = randomBytes(1)[0] ?? 0;
    const fwd = `203.0.113.${octet}`;
    const headers = { "x-forwarded-for": fwd };

    let saw429 = false;
    for (let i = 0; i < 25; i++) {
      const { status } = await getJson("ZZZZZZZZZZZZZZZZ", headers);
      if (status === 429) {
        saw429 = true;
        break;
      }
      expect(status).toBe(404);
    }
    expect(saw429).toBe(true);
  });

  it("キャンセル成功時にキャンセル完了メール処理が呼ばれる", async () => {
    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenPlain = CANCEL_MAIL_TEST_TOKEN_RAW;
    const tokenHash = hashReservationTokenPlainForTest(tokenPlain);
    const emailLocal = `get-cancel-${eventDayId.slice(0, 8)}`;
    const email = `${emailLocal}@example.test`;
    const supabase = getIntegrationSupabase();
    try {
      const { data: rpcData, error: cErr } = await supabase.rpc(
        "create_public_reservation",
        baseCreateRpc(eventDayId, morningSlotId, tokenHash, emailLocal, publicRef)
      );
      expect(cErr).toBeNull();
      void reservationIdFromCreateRpcPayload(rpcData);

      const res = await POST_CANCEL(
        new Request(`http://localhost/api/reservations/${encodeURIComponent(tokenPlain)}/cancel`, {
          method: "POST",
        }),
        { params: Promise.resolve({ token: tokenPlain }) }
      );
      expect(res.status).toBe(200);
      expect(sendCancelMailMock).toHaveBeenCalledTimes(1);
      const arg = sendCancelMailMock.mock.calls[0]![0] as {
        to: string;
        publicRef: string | null;
      };
      expect(arg.to).toBe(email);
      expect(arg.publicRef).toBe(publicRef);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });

  it("管理再送後も public_ref は不変で token ハッシュのみ変わる", async () => {
    adminUserMock.mockResolvedValue({ id: "integration-admin-stub" } as User);

    const { eventDayId, morningSlotId } = await insertEventDayWithSlots({
      status: "open",
      reservationDeadlineAtIso: futureDeadlineIso,
    });
    const publicRef = testReservationPublicRef();
    const tokenPlain1 = RESEND_ROTATION_FIRST_TOKEN_RAW;
    const hash1 = hashReservationTokenPlainForTest(tokenPlain1);
    const emailLocal = `get-resend-${eventDayId.slice(0, 8)}`;
    const email = `${emailLocal}@example.test`;
    const hashAfterResend = hashReservationTokenPlainForTest(RESEND_TEST_SECOND_TOKEN);
    const supabase = getIntegrationSupabase();
    try {
      const { data: created, error: cErr } = await supabase.rpc("create_public_reservation", {
        ...baseCreateRpc(eventDayId, morningSlotId, hash1, emailLocal, publicRef),
      });
      expect(cErr).toBeNull();
      const reservationId = reservationIdFromCreateRpcPayload(created);

      const { data: before } = await supabase
        .from("reservations")
        .select("public_ref, reservation_token_hash")
        .eq("id", reservationId)
        .single();
      expect(before?.public_ref).toBe(publicRef);
      expect(before?.reservation_token_hash).toBe(hash1);

      const resendRes = await withResendEnv(() =>
        POST_RESEND(
          new Request("http://localhost/api/admin/x", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toEmail: email }),
          }),
          { params: Promise.resolve({ id: reservationId }) }
        )
      );
      expect(resendRes.status).toBe(200);

      const { data: after } = await supabase
        .from("reservations")
        .select("public_ref, reservation_token_hash")
        .eq("id", reservationId)
        .single();
      expect(after?.public_ref).toBe(publicRef);
      expect(after?.reservation_token_hash).not.toBe(hash1);
      expect(after?.reservation_token_hash).toBe(hashAfterResend);

      const { status: oldGone } = await getJson(tokenPlain1);
      expect(oldGone).toBe(404);

      const { status: newOk } = await getJson(RESEND_TEST_SECOND_TOKEN);
      expect(newOk).toBe(200);
    } finally {
      await deleteEventDayById(eventDayId);
    }
  });
});
