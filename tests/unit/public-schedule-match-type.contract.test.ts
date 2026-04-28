import { describe, expect, it } from "vitest";

import type { PublicScheduleConfirmedMatch } from "@/lib/event-days/public-schedule-for-day";

/** 試合ペイロードから割当 UUID（id）を除去したことを型で固定 */
type HasNoAssignmentId = PublicScheduleConfirmedMatch extends { id: unknown }
  ? never
  : true;

describe("public-schedule 契約（型）", () => {
  it("PublicScheduleConfirmedMatch に id がない", () => {
    const ok: HasNoAssignmentId = true;
    expect(ok).toBe(true);
  });
});
