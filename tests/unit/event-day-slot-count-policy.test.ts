import { describe, expect, it } from "vitest";

import {
  canAppendEventDaySlotForPhase,
  eventDaySlotPhaseCountsOk,
} from "@/lib/event-days/event-day-slot-count-policy";

describe("event-day-slot-count-policy", () => {
  it("V2: 午前6・午後0（U-2）や午前4+午後2などを許容", () => {
    expect(eventDaySlotPhaseCountsOk(6, 0)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(4, 2)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(3, 3)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(7, 0)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(0, 0)).toBe(false);
  });

  it("枠の追加は常に不可（10行固定運用）", () => {
    expect(canAppendEventDaySlotForPhase(6, 0, "morning")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 2, "afternoon")).toBe(false);
  });
});
