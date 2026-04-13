import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/cron/lock-event-days/route";

/**
 * CRON_SECRET の読み取りはリクエスト時の process.env。
 * Supabase 未起動でも 503 / 401 までは検証できる。
 */
describe("integration: GET /api/cron/lock-event-days（認証分岐）", () => {
  it("CRON_SECRET 未設定 → 503", async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const req = new NextRequest("http://localhost/api/cron/lock-event-days");
      const res = await GET(req);
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error?: string };
      expect(json.error).toMatch(/CRON_SECRET/);
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev;
      else delete process.env.CRON_SECRET;
    }
  });

  it("CRON_SECRET あり・Bearer 不一致 → 401", async () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-for-vitest-16";
    try {
      const req = new NextRequest("http://localhost/api/cron/lock-event-days", {
        headers: { Authorization: "Bearer wrong-secret-value-here" },
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev;
      else delete process.env.CRON_SECRET;
    }
  });
});
