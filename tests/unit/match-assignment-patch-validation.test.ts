import { describe, expect, it } from "vitest";

import {
  intervalsOverlap,
  overlappingTeamConflict,
  slotIntervalMinutes,
  timeToMinutes,
} from "@/lib/admin/match-assignment-patch-validation";

describe("timeToMinutes", () => {
  it("parses HH:MM:SS", () => {
    expect(timeToMinutes("09:30:00")).toBe(9 * 60 + 30);
  });
});

describe("intervalsOverlap", () => {
  it("detects overlap", () => {
    expect(intervalsOverlap([0, 60], [30, 90])).toBe(true);
  });
  it("detects no overlap", () => {
    expect(intervalsOverlap([0, 30], [30, 60])).toBe(false);
  });
});

describe("overlappingTeamConflict", () => {
  it("returns null when no team overlap in overlapping time", () => {
    const a = slotIntervalMinutes({ startTime: "09:00:00", endTime: "10:00:00" });
    const b = slotIntervalMinutes({ startTime: "09:30:00", endTime: "10:30:00" });
    const err = overlappingTeamConflict([
      { assignmentId: "1", slotId: "s1", interval: a, teamIds: ["t1", "t2"] },
      { assignmentId: "2", slotId: "s2", interval: b, teamIds: ["t3", "t4"] },
    ]);
    expect(err).toBeNull();
  });

  it("detects same team in overlapping slots", () => {
    const a = slotIntervalMinutes({ startTime: "09:00:00", endTime: "10:00:00" });
    const b = slotIntervalMinutes({ startTime: "09:30:00", endTime: "10:30:00" });
    const err = overlappingTeamConflict([
      { assignmentId: "1", slotId: "s1", interval: a, teamIds: ["t1", "t2"] },
      { assignmentId: "2", slotId: "s2", interval: b, teamIds: ["t1", "t5"] },
    ]);
    expect(err).toContain("重複");
  });
});
