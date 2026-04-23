import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { deleteEventDayById, insertEventDayWithSlots } from "./helpers/seed-event-day";
import { getIntegrationSupabase, hasSupabaseEnv } from "./helpers/service-role-client";

import type { User } from "@supabase/supabase-js";

const { adminUserMock } = vi.hoisted(() => ({
  adminUserMock: vi.fn<[], Promise<User | null>>().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  getAdminUser: () => adminUserMock() as Promise<User | null>,
}));

import { PATCH as patchEventDay } from "@/app/api/admin/event-days/[id]/route";

const GRADE = "__integration_event_day_open_lunch__";
const futureDeadlineIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

let testAdminId: string;
let testAdminUser: User;
/** DB に `event_day_lunch_menu_items` が無い（マイグレーション未適用）ときは専用行系テストをスキップ */
let hasEventDayLunchMenuItemsTable = false;
/** このファイルでだけ投入したグローバル昼食（後始末用） */
let ensuredGlobalLunchId: string | null = null;

async function ensureAtLeastOneActiveGlobalLunch(): Promise<void> {
  const supa = getIntegrationSupabase();
  const { count, error } = await supa
    .from("lunch_menu_items")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  if ((count ?? 0) >= 1) return;

  const { data, error: insErr } = await supa
    .from("lunch_menu_items")
    .insert({
      name: "結合テスト用グローバル昼食（open ゲート用・自動投入）",
      description: null,
      price_tax_included: 600,
      is_active: true,
      sort_order: -100,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  ensuredGlobalLunchId = data.id as string;
}

function patchJsonReq(body: unknown) {
  return new Request("http://localhost/api/admin/event-days/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasSupabaseEnv())(
  "integration: 開催日 draft→open と昼食ゲート",
  () => {
    beforeAll(async () => {
      const supa = getIntegrationSupabase();
      await ensureAtLeastOneActiveGlobalLunch();

      const { error: junctionProbe } = await supa
        .from("event_day_lunch_menu_items")
        .select("event_day_id")
        .limit(1);
      hasEventDayLunchMenuItemsTable =
        junctionProbe === null || junctionProbe.code !== "PGRST205";

      const { data, error } = await supa.auth.admin.createUser({
        email: `admin-open-lunch-${Date.now()}-${randomBytes(4).toString("hex")}@test.local`,
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
      if (ensuredGlobalLunchId) {
        const supa = getIntegrationSupabase();
        const { error } = await supa.from("lunch_menu_items").delete().eq("id", ensuredGlobalLunchId);
        if (error) console.warn("結合テスト用昼食の削除に失敗", error.message);
        ensuredGlobalLunchId = null;
      }
      if (!testAdminId) return;
      const supa = getIntegrationSupabase();
      const { error } = await supa.auth.admin.deleteUser(testAdminId);
      if (error) console.warn("admin テストユーザー削除失敗", error.message);
    });

    it("ED-OPEN-LUNCH-200: 専用行なし（グローバルフォールバック）で open が 200", async () => {
      const { eventDayId } = await insertEventDayWithSlots({
        status: "draft",
        reservationDeadlineAtIso: futureDeadlineIso,
        gradeBand: GRADE,
      });
      try {
        const res = await patchEventDay(patchJsonReq({ status: "open" }), {
          params: Promise.resolve({ id: eventDayId }),
        });
        const resBody = (await res.json()) as { eventDay?: { status?: string } };
        expect(res.status).toBe(200);
        expect(resBody.eventDay?.status).toBe("open");
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });

    it("ED-OPEN-LUNCH-CUSTOM-200: 専用行が有効メニューのみなら open が 200", async (ctx) => {
      if (!hasEventDayLunchMenuItemsTable) ctx.skip();
      const supa = getIntegrationSupabase();
      const { data: menus, error: mErr } = await supa
        .from("lunch_menu_items")
        .select("id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1);
      expect(mErr).toBeNull();
      const activeId = menus?.[0]?.id as string | undefined;
      expect(activeId).toBeTruthy();

      const { eventDayId } = await insertEventDayWithSlots({
        status: "draft",
        reservationDeadlineAtIso: futureDeadlineIso,
        gradeBand: GRADE,
      });
      try {
        const { error: linkErr } = await supa.from("event_day_lunch_menu_items").insert({
          event_day_id: eventDayId,
          lunch_menu_item_id: activeId!,
          sort_order: 0,
        });
        expect(linkErr).toBeNull();

        const res = await patchEventDay(patchJsonReq({ status: "open" }), {
          params: Promise.resolve({ id: eventDayId }),
        });
        expect(res.status).toBe(200);
      } finally {
        await deleteEventDayById(eventDayId);
      }
    });

    it("ED-OPEN-LUNCH-422: 専用行が非公開メニューのみなら open は 422", async (ctx) => {
      if (!hasEventDayLunchMenuItemsTable) ctx.skip();
      const supa = getIntegrationSupabase();
      const { data: ghost, error: insErr } = await supa
        .from("lunch_menu_items")
        .insert({
          name: "結合テスト用（非公開のみ）",
          description: null,
          price_tax_included: 500,
          is_active: false,
          sort_order: 9999,
        })
        .select("id")
        .single();
      expect(insErr).toBeNull();
      const ghostId = ghost!.id as string;

      const { eventDayId } = await insertEventDayWithSlots({
        status: "draft",
        reservationDeadlineAtIso: futureDeadlineIso,
        gradeBand: GRADE,
      });
      try {
        const { error: linkErr } = await supa.from("event_day_lunch_menu_items").insert({
          event_day_id: eventDayId,
          lunch_menu_item_id: ghostId,
          sort_order: 0,
        });
        expect(linkErr).toBeNull();

        const res = await patchEventDay(patchJsonReq({ status: "open" }), {
          params: Promise.resolve({ id: eventDayId }),
        });
        expect(res.status).toBe(422);
        const j = (await res.json()) as { error?: string };
        expect(j.error).toMatch(/選べる昼食|予約受付を開始できません/);
      } finally {
        await deleteEventDayById(eventDayId);
        await supa.from("lunch_menu_items").delete().eq("id", ghostId);
      }
    });
  }
);
