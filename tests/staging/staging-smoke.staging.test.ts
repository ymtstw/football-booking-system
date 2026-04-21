import { describe, expect, it } from "vitest";

/**
 * Master_TestSpec.csv / MVP_Minimum_Run.csv のうち、Staging に対して fetch だけで検証できる範囲。
 * 実施方式・自動化対象の整理: docs/qa/MVP_Minimum_Run.csv（列: 実施方式〜備考）
 *
 * 実行例（PowerShell）:
 *   $env:STAGING_BASE_URL="https://stg-rsv-soccer.greenplanet-project.com"
 *   npm run test:staging
 *
 * 管理 API（MVP-DASH-*）を含める場合:
 *   ブラウザで Staging に管理者ログイン後、DevTools → Application → Cookies から
 *   `sb-...-auth-token` 等を含む Cookie ヘッダー文字列をコピーし:
 *   $env:STAGING_ADMIN_COOKIE="sb-xxxxx-auth-token=..."
 *
 * 参照ケース ID: API-AV-001, API-ED-001, TK-001, MVP-DASH-400, MVP-DASH-200, CK-001, MVP-NOTIF-401, undo 認証
 */

function stagingBaseUrl(): string | null {
  const raw = process.env.STAGING_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

async function stagingFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = stagingBaseUrl();
  if (!base) throw new Error("STAGING_BASE_URL が未設定です");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    redirect: "follow",
    headers: {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...init?.headers,
    },
  });
}

describe.skipIf(!stagingBaseUrl())("staging smoke: 公開 API", () => {
  it("API-AV-001: 日付形式不正は 400（GET …/availability）", async () => {
    const res = await stagingFetch("/api/event-days/not-a-date/availability");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/YYYY-MM-DD/);
  });

  it("API-AV-001: 該当開催日なしは 404", async () => {
    const res = await stagingFetch("/api/event-days/1900-01-01/availability");
    expect(res.status).toBe(404);
  });

  it("API-ED-001: GET /api/event-days は 200・acceptingReservations 整合", async () => {
    const res = await stagingFetch("/api/event-days");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      eventDays?: Array<{
        id: string;
        event_date: string;
        grade_band: string;
        status: string;
        reservation_deadline_at: string;
        acceptingReservations: boolean;
        morningRemainingVacancies: number | null;
      }>;
    };
    expect(Array.isArray(json.eventDays)).toBe(true);
    const now = Date.now();
    for (const row of json.eventDays ?? []) {
      expect(typeof row.acceptingReservations).toBe("boolean");
      const t = new Date(row.reservation_deadline_at).getTime();
      const expectedAccepting =
        row.status === "open" && Number.isFinite(t) && t > now;
      expect(row.acceptingReservations).toBe(expectedAccepting);
      if (row.acceptingReservations) {
        expect(typeof row.morningRemainingVacancies).toBe("number");
      } else {
        expect(row.morningRemainingVacancies).toBeNull();
      }
    }
  });

  it("TK-001: 形式不正トークンは 404（GET /api/reservations/{token}）", async () => {
    const res = await stagingFetch("/api/reservations/short");
    expect(res.status).toBe(404);
  });

  it("トップ / が 200（イベント案内）", async () => {
    const res = await stagingFetch("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.length).toBeGreaterThan(500);
    expect(html).toMatch(/案内|予約|交流|サッカー|小学生/);
  });
});

describe.skipIf(!stagingBaseUrl())("staging smoke: 管理 API（Cookie 要・MVP-DASH）", () => {
  const adminCookie = () => process.env.STAGING_ADMIN_COOKIE?.trim() ?? "";

  it.skipIf(!adminCookie())("MVP-DASH-400: after 欠落は 400", async () => {
    const res = await stagingFetch("/api/admin/dashboard/next-event-day", {
      headers: { Cookie: adminCookie() },
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/after|YYYY-MM-DD/);
  });

  it.skipIf(!adminCookie())("MVP-DASH-400: 暦日無効 after は 400", async () => {
    const res = await stagingFetch(
      "/api/admin/dashboard/next-event-day?after=2026-02-30",
      { headers: { Cookie: adminCookie() } }
    );
    expect(res.status).toBe(400);
  });

  it.skipIf(!adminCookie())("MVP-DASH-200: after=2099-12-31 で day が null になり得る（200）", async () => {
    const res = await stagingFetch(
      "/api/admin/dashboard/next-event-day?after=2099-12-31",
      { headers: { Cookie: adminCookie() } }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { day: unknown };
    expect(json).toHaveProperty("day");
    expect(json.day).toBeNull();
  });
});

describe.skipIf(!stagingBaseUrl())("staging smoke: Cron 認証（CK-001）", () => {
  it("Authorization Bearer 誤りは 401 または 503（CRON_SECRET 未設定時）", async () => {
    const res = await stagingFetch("/api/cron/lock-event-days", {
      headers: { Authorization: "Bearer definitely-wrong-secret-for-smoke-test" },
    });
    expect([401, 503]).toContain(res.status);
  });
});

describe.skipIf(!stagingBaseUrl())("staging smoke: 管理通知・編成 undo（認証）", () => {
  it("MVP-NOTIF-401: 未認証 GET /api/admin/notifications → 401", async () => {
    const res = await stagingFetch("/api/admin/notifications?status=failed");
    expect(res.status).toBe(401);
  });

  it("TC-EX-UN-401: POST /api/admin/matching/undo 未認証 → 401（Cookie なし）", async () => {
    const res = await stagingFetch("/api/admin/matching/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDayId: "00000000-0000-4000-8000-000000000099",
      }),
    });
    expect(res.status).toBe(401);
  });
});
