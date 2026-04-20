import { describe, expect, it } from "vitest";

import {
  canAppendEventDaySlotForPhase,
  eventDaySlotPhaseCountsOk,
} from "@/lib/event-days/event-day-slot-count-policy";

describe("event-day-slot-count-policy", () => {
  it("最終形: 3+3 と 4+4 のみ OK（旧データ互換で 3+3 も許容）", () => {
    expect(eventDaySlotPhaseCountsOk(3, 3)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(4, 4)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(4, 3)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(3, 4)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(2, 2)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(5, 5)).toBe(false);
  });

  it("新方針: 枠の追加は常に不可（4+4 固定運用）", () => {
    expect(canAppendEventDaySlotForPhase(3, 3, "morning")).toBe(false);
    expect(canAppendEventDaySlotForPhase(3, 3, "afternoon")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 3, "afternoon")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 4, "morning")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 4, "afternoon")).toBe(false);
  });
});
