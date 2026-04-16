import { describe, expect, it } from "vitest";

import {
  buildMatchingAssignments,
  type SlotRow,
} from "@/domains/matching/build-matching-assignments";

function playCounts(
  assignments: { reservation_a_id: string; reservation_b_id: string; match_phase: string }[],
  ids: string[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, 0);
  for (const row of assignments) {
    if (row.match_phase !== "morning" && row.match_phase !== "afternoon") continue;
    m.set(row.reservation_a_id, (m.get(row.reservation_a_id) ?? 0) + 1);
    m.set(row.reservation_b_id, (m.get(row.reservation_b_id) ?? 0) + 1);
  }
  return m;
}

describe("buildMatchingAssignments / 全日目標試合数", () => {
  it("3チーム・午後3枠のみでも午後3枠すべて試合が入り全員2試合", () => {
    const afternoonSlots: SlotRow[] = [1, 2, 3].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));

    const reservations = ["x1", "x2", "x3"].map((id) => ({
      id,
      selected_morning_slot_id: null as string | null,
      team_id: `team-${id}`,
      teams: { strength_category: "strong" as const, representative_grade_year: 3 },
    }));

    const result = buildMatchingAssignments({
      slots: afternoonSlots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    expect(result.assignments.filter((r) => r.match_phase === "afternoon").length).toBe(3);
    const ids = ["x1", "x2", "x3"];
    const counts = playCounts(result.assignments, ids);
    expect(ids.every((id) => (counts.get(id) ?? 0) === 2)).toBe(true);
    const values = ids.map((id) => counts.get(id) ?? 0);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("4チーム・午前2枠＋午後4枠（計6試合）なら全員ちょうど3試合（2と4の分裂を出さない）", () => {
    const morningSlots: SlotRow[] = [
      { id: "slot-m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "slot-m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const afternoonSlots: SlotRow[] = [1, 2, 3, 4].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];

    const reservations = [
      {
        id: "r1",
        selected_morning_slot_id: "slot-m1",
        team_id: "t1",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "r2",
        selected_morning_slot_id: "slot-m1",
        team_id: "t2",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "r3",
        selected_morning_slot_id: "slot-m2",
        team_id: "t3",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "r4",
        selected_morning_slot_id: "slot-m2",
        team_id: "t4",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
    ];

    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    const ids = ["r1", "r2", "r3", "r4"];
    const counts = playCounts(result.assignments, ids);
    const values = ids.map((id) => counts.get(id) ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    expect(max - min).toBeLessThanOrEqual(1);
    expect(values.every((v) => v === 3)).toBe(true);
    expect(result.assignments.filter((r) => r.match_phase === "afternoon").length).toBe(4);
    expect(result.assignments.filter((r) => r.match_phase === "morning").length).toBe(2);

    const afternoonRows = result.assignments.filter((r) => r.match_phase === "afternoon");
    expect(
      afternoonRows.every((r) => !r.warning_json.includes("cross_category_match"))
    ).toBe(true);
  });

  it("strong が奇数人数のときは全日のどこかで異カ組み合わせが入る", () => {
    const morningSlots: SlotRow[] = [
      { id: "slot-m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "slot-m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const afternoonSlots: SlotRow[] = [1, 2, 3, 4].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];

    const reservations = [
      {
        id: "s1",
        selected_morning_slot_id: "slot-m1",
        team_id: "ts",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "p1",
        selected_morning_slot_id: "slot-m1",
        team_id: "tp1",
        teams: { strength_category: "potential" as const, representative_grade_year: 4 },
      },
      {
        id: "p2",
        selected_morning_slot_id: "slot-m2",
        team_id: "tp2",
        teams: { strength_category: "potential" as const, representative_grade_year: 4 },
      },
      {
        id: "p3",
        selected_morning_slot_id: "slot-m2",
        team_id: "tp3",
        teams: { strength_category: "potential" as const, representative_grade_year: 4 },
      },
    ];

    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    const hasCross = result.assignments.some((r) =>
      r.warning_json.includes("cross_category_match")
    );
    expect(hasCross).toBe(true);

    const ids = ["s1", "p1", "p2", "p3"];
    const counts = playCounts(result.assignments, ids);
    const values = ids.map((id) => counts.get(id) ?? 0);
    expect(values.every((v) => v === 3)).toBe(true);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("午前で同カ同士が対戦済みのとき、可行性で同カ重複が残るなら異カ非重複より先に選ばれる（2s2p・均等維持）", () => {
    const morningSlots: SlotRow[] = [
      { id: "slot-m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "slot-m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const afternoonSlots: SlotRow[] = [1, 2, 3, 4].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];

    const reservations = [
      {
        id: "s1",
        selected_morning_slot_id: "slot-m1",
        team_id: "ts1",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "s2",
        selected_morning_slot_id: "slot-m1",
        team_id: "ts2",
        teams: { strength_category: "strong" as const, representative_grade_year: 3 },
      },
      {
        id: "p1",
        selected_morning_slot_id: "slot-m2",
        team_id: "tp1",
        teams: { strength_category: "potential" as const, representative_grade_year: 4 },
      },
      {
        id: "p2",
        selected_morning_slot_id: "slot-m2",
        team_id: "tp2",
        teams: { strength_category: "potential" as const, representative_grade_year: 4 },
      },
    ];

    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    const afternoonOrdered = [...result.assignments]
      .filter((r) => r.match_phase === "afternoon")
      .sort((a, b) => a.event_day_slot_id.localeCompare(b.event_day_slot_id));

    const firstAf = afternoonOrdered[0];
    expect(firstAf).toBeDefined();
    const w = firstAf!.warning_json;
    expect(w).toContain("afternoon_pair_pick_tier_C");
    expect(w).not.toContain("cross_category_match");

    const counts = playCounts(result.assignments, ["s1", "s2", "p1", "p2"]);
    const values = ["s1", "s2", "p1", "p2"].map((id) => counts.get(id) ?? 0);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(values.every((v) => v === 3)).toBe(true);

    const strength = (id: string) =>
      reservations.find((r) => r.id === id)!.teams.strength_category;
    const sameStrengthAfternoon = afternoonOrdered.filter(
      (r) => strength(r.reservation_a_id) === strength(r.reservation_b_id)
    ).length;
    expect(sameStrengthAfternoon).toBeGreaterThanOrEqual(2);
  });

  it("3チーム・午前4枠+午後2枠（計6試合・12出場）で全枠に行が付きtarget短fallが無い", () => {
    const morningSlots = [1, 2, 3, 4].map((i) => ({
      id: `slot-m${i}`,
      slot_code: `M${i}`,
      phase: "morning" as const,
      is_active: true,
    }));
    const afternoonSlots = [1, 2].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];
    const reservations = ["x1", "x2", "x3"].map((id, i) => ({
      id,
      selected_morning_slot_id: morningSlots[i]!.id,
      team_id: `team-${id}`,
      teams: { strength_category: "strong" as const, representative_grade_year: 3 },
    }));

    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    for (const s of slots) {
      expect(result.assignments.some((r) => r.event_day_slot_id === s.id)).toBe(true);
    }
    expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
    expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
    const ids = ["x1", "x2", "x3"];
    const counts = playCounts(result.assignments, ids);
    const vals = ids.map((id) => counts.get(id) ?? 0);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("3チーム・午前4枠+午後4枠（計8試合）で全枠に行が付き午後未割当・target不足なし（多枠で午後2本固定上限が無いこと）", () => {
    const morningSlots = [1, 2, 3, 4].map((i) => ({
      id: `slot-m${i}`,
      slot_code: `M${i}`,
      phase: "morning" as const,
      is_active: true,
    }));
    const afternoonSlots = [1, 2, 3, 4].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];
    const reservations = ["x1", "x2", "x3"].map((id, i) => ({
      id,
      selected_morning_slot_id: morningSlots[i]!.id,
      team_id: `team-${id}`,
      teams: { strength_category: "strong" as const, representative_grade_year: 3 },
    }));

    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    for (const s of slots) {
      expect(result.assignments.some((r) => r.event_day_slot_id === s.id)).toBe(true);
    }
    expect(result.assignments.filter((r) => r.match_phase === "afternoon")).toHaveLength(4);
    expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
    expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
    const ids = ["x1", "x2", "x3"];
    const counts = playCounts(result.assignments, ids);
    const vals = ids.map((id) => counts.get(id) ?? 0);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("4チーム・午前2枠のみなら全員ちょうど1午前試合で repeat_morning_play が出ない", () => {
    const morningSlots = [1, 2].map((i) => ({
      id: `slot-m${i}`,
      slot_code: `M${i}`,
      phase: "morning" as const,
      is_active: true,
    }));
    const reservations = ["r1", "r2", "r3", "r4"].map((id, i) => ({
      id,
      selected_morning_slot_id: morningSlots[i % 2]!.id,
      team_id: `t-${id}`,
      teams: { strength_category: "strong" as const, representative_grade_year: 3 },
    }));

    const result = buildMatchingAssignments({
      slots: morningSlots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    expect(result.assignments.filter((r) => r.match_phase === "morning")).toHaveLength(2);
    for (const id of ["r1", "r2", "r3", "r4"]) {
      const n = result.assignments.filter(
        (r) =>
          r.match_phase === "morning" &&
          (r.reservation_a_id === id || r.reservation_b_id === id)
      ).length;
      expect(n).toBe(1);
    }
    expect(
      result.assignments.some((r) => r.warning_json.includes("repeat_morning_play"))
    ).toBe(false);
  });

  it("4チーム・午後4枠のみでは全枠埋まり、先頭2試合は第2巡（緩和）ではない", () => {
    const afternoonSlots = [1, 2, 3, 4].map((i) => ({
      id: `slot-a${i}`,
      slot_code: `A${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const reservations = ["q1", "q2", "q3", "q4"].map((id) => ({
      id,
      selected_morning_slot_id: null as string | null,
      team_id: `team-${id}`,
      teams: { strength_category: "strong" as const, representative_grade_year: 3 },
    }));

    const result = buildMatchingAssignments({
      slots: afternoonSlots,
      reservationsActive: reservations,
      currentAssignments: [],
    });

    expect(result.assignments.filter((r) => r.match_phase === "afternoon")).toHaveLength(4);
    const ordered = [...result.assignments]
      .filter((r) => r.match_phase === "afternoon")
      .sort((a, b) => a.event_day_slot_id.localeCompare(b.event_day_slot_id));
    for (let i = 0; i < Math.min(2, ordered.length); i++) {
      expect(ordered[i]!.warning_json.includes("afternoon_second_round_fill")).toBe(false);
    }
    const idxSecond = ordered.findIndex((r) =>
      r.warning_json.includes("afternoon_second_round_fill")
    );
    expect(idxSecond).toBeGreaterThanOrEqual(2);
  });
});
