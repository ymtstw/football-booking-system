import { describe, expect, it } from "vitest";

import {
  canAppendEventDaySlotForPhase,
  eventDaySlotPhaseCountsOk,
} from "@/lib/event-days/event-day-slot-count-policy";

describe("event-day-slot-count-policy", () => {
  it("最終形: 3+3 と 4+4 のみ OK", () => {
    expect(eventDaySlotPhaseCountsOk(3, 3)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(4, 4)).toBe(true);
    expect(eventDaySlotPhaseCountsOk(4, 3)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(3, 4)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(2, 2)).toBe(false);
    expect(eventDaySlotPhaseCountsOk(5, 5)).toBe(false);
  });

  it("追加: 3+3 から午前または午後に1枠ずつ可能", () => {
    expect(canAppendEventDaySlotForPhase(3, 3, "morning")).toBe(true);
    expect(canAppendEventDaySlotForPhase(3, 3, "afternoon")).toBe(true);
  });

  it("追加: 4+3 なら不足側のみ可能", () => {
    expect(canAppendEventDaySlotForPhase(4, 3, "morning")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 3, "afternoon")).toBe(true);
  });

  it("追加: 4+4 ではこれ以上不可", () => {
    expect(canAppendEventDaySlotForPhase(4, 4, "morning")).toBe(false);
    expect(canAppendEventDaySlotForPhase(4, 4, "afternoon")).toBe(false);
  });
});
