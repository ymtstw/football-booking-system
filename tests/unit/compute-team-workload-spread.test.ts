import {
  computeTeamWorkloadSpread,
  type MergedAsgRow,
  type ResShape,
} from "@/lib/admin/validate-merged-match-assignments";
import { describe, expect, it } from "vitest";

function resMap(entries: [string, string][]): Map<string, ResShape> {
  const m = new Map<string, ResShape>();
  for (const [id, team_id] of entries) {
    m.set(id, { id, team_id, status: "active" });
  }
  return m;
}

describe("computeTeamWorkloadSpread", () => {
  it("差が 1 以下なら確認不要", () => {
    /** 1 試合のみ：対戦は t1・t2 が各 1、審判は t3 が 1（いずれの spread も 1 以下） */
    const merged: MergedAsgRow[] = [
      {
        id: "m1",
        event_day_slot_id: "s1",
        match_phase: "afternoon",
        reservation_a_id: "ra",
        reservation_b_id: "rb",
        referee_reservation_id: "rc",
      },
    ];
    const res = resMap([
      ["ra", "t1"],
      ["rb", "t2"],
      ["rc", "t3"],
    ]);
    const w = computeTeamWorkloadSpread(merged, res);
    expect(w.matchSpread).toBeLessThanOrEqual(1);
    expect(w.refSpread).toBeLessThanOrEqual(1);
    expect(w.needsWorkloadConfirm).toBe(false);
  });

  it("出場試合数の差が 2 以上なら確認が必要", () => {
    const merged: MergedAsgRow[] = [
      {
        id: "m1",
        event_day_slot_id: "s1",
        match_phase: "afternoon",
        reservation_a_id: "ra",
        reservation_b_id: "rb",
        referee_reservation_id: null,
      },
      {
        id: "m2",
        event_day_slot_id: "s2",
        match_phase: "afternoon",
        reservation_a_id: "ra",
        reservation_b_id: "rc",
        referee_reservation_id: null,
      },
      {
        id: "m3",
        event_day_slot_id: "s3",
        match_phase: "afternoon",
        reservation_a_id: "ra",
        reservation_b_id: "rd",
        referee_reservation_id: null,
      },
    ];
    const res = resMap([
      ["ra", "t1"],
      ["rb", "t2"],
      ["rc", "t3"],
      ["rd", "t4"],
    ]);
    const w = computeTeamWorkloadSpread(merged, res);
    expect(w.matchSpread).toBeGreaterThanOrEqual(2);
    expect(w.needsWorkloadConfirm).toBe(true);
  });

  it("審判回数の差が 2 以上なら確認が必要（出場は均等でも）", () => {
    const merged: MergedAsgRow[] = [
      {
        id: "m1",
        event_day_slot_id: "s1",
        match_phase: "afternoon",
        reservation_a_id: "ra",
        reservation_b_id: "rb",
        referee_reservation_id: "rf1",
      },
      {
        id: "m2",
        event_day_slot_id: "s2",
        match_phase: "afternoon",
        reservation_a_id: "rc",
        reservation_b_id: "rd",
        referee_reservation_id: "rf1",
      },
      {
        id: "m3",
        event_day_slot_id: "s3",
        match_phase: "afternoon",
        reservation_a_id: "re",
        reservation_b_id: "rf",
        referee_reservation_id: "rf1",
      },
    ];
    const res = resMap([
      ["ra", "t1"],
      ["rb", "t2"],
      ["rc", "t3"],
      ["rd", "t4"],
      ["re", "t5"],
      ["rf", "t6"],
      ["rf1", "tRef"],
    ]);
    const w = computeTeamWorkloadSpread(merged, res);
    expect(w.refSpread).toBeGreaterThanOrEqual(2);
    expect(w.needsWorkloadConfirm).toBe(true);
  });
});
