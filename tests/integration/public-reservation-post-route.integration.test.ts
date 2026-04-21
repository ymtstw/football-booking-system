import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/reservations/route";

import { hasSupabaseEnv } from "./helpers/service-role-client";

const validTeam = {
  teamName: "POST結合チーム",
  strengthCategory: "strong" as const,
  representativeGradeYear: 3,
  contactName: "テスト太郎",
  contactEmail: `post-route-${Date.now()}@example.test`,
  contactPhone: "09012345678",
};

function postReservation(body: unknown) {
  return POST(
    new Request("http://localhost/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("integration: POST /api/reservations（入力検証・RSV-022 422）", () => {
  it("eventDayId が UUID 形式でない → 422", async () => {
    const res = await postReservation({
      eventDayId: "not-a-uuid",
      selectedMorningSlotId: "00000000-0000-4000-8000-000000000002",
      team: { ...validTeam, contactEmail: `bad-day-${Date.now()}@example.test` },
      participantCount: 1,
      lunchItems: [],
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/UUID/);
  });

  it("selectedMorningSlotId が UUID 形式でない → 422", async () => {
    const res = await postReservation({
      eventDayId: "00000000-0000-4000-8000-000000000001",
      selectedMorningSlotId: "bad-slot",
      team: { ...validTeam, contactEmail: `bad-slot-${Date.now()}@example.test` },
      participantCount: 1,
      lunchItems: [],
    });
    expect(res.status).toBe(422);
  });
});

describe.skipIf(!hasSupabaseEnv())("integration: POST /api/reservations（RSV-022 404）", () => {
  it("存在しない eventDayId・枠 → 404", async () => {
    const res = await postReservation({
      eventDayId: "00000000-0000-4000-8000-000000000099",
      selectedMorningSlotId: "00000000-0000-4000-8000-000000000088",
      team: { ...validTeam, contactEmail: `ghost-${Date.now()}@example.test` },
      participantCount: 1,
      lunchItems: [],
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/見つからない|対象/);
  });
});
