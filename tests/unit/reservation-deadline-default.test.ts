import { describe, expect, it } from "vitest";

import { defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst } from "@/lib/dates/reservation-deadline-default";

describe("defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst", () => {
  it("開催2日前の15:00 JSTを返す", () => {
    expect(defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst("2026-04-20")).toBe(
      "2026-04-18T15:00:00+09:00"
    );
  });
});
