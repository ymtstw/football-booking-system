import { describe, expect, it } from "vitest";

import {
  buildMatchingAssignments,
  type RpcAssignmentRow,
  type SlotRow,
} from "@/domains/matching/build-matching-assignments";

type ReservationInput = Parameters<typeof buildMatchingAssignments>[0]["reservationsActive"][number];
type CurrentAssignmentInput = Parameters<typeof buildMatchingAssignments>[0]["currentAssignments"][number];

function strongRes(id: string, morningSlotId: string | null): ReservationInput {
  return {
    id,
    selected_morning_slot_id: morningSlotId,
    team_id: `team-${id}`,
    teams: { strength_category: "strong" as const, representative_grade_year: 3 },
  };
}

function potentialRes(id: string, morningSlotId: string | null): ReservationInput {
  return {
    id,
    selected_morning_slot_id: morningSlotId,
    team_id: `team-${id}`,
    teams: { strength_category: "potential" as const, representative_grade_year: 4 },
  };
}

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

describe("buildMatchingAssignments / 境界・異常寄り（MT-6-E01 等）", () => {
  it("参加0件: 打ち切り・assignments 空・meta の配列は空", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
    ];
    const result = buildMatchingAssignments({
      slots,
      reservationsActive: [],
      currentAssignments: [],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.meta.unfilledMorningReservationIds).toEqual([]);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
    expect(result.meta.notes.some((n) => n.includes("2チーム未満"))).toBe(true);
  });

  it("参加1件のみ: 打ち切り・その1件が全日未充足として列挙", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
    ];
    const result = buildMatchingAssignments({
      slots,
      reservationsActive: [strongRes("solo", "m1")],
      currentAssignments: [],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.meta.unfilledMorningReservationIds).toEqual(["solo"]);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual(["solo"]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual(["solo"]);
  });

  it("morning_fixed の当事者が active にいない場合は行ごと除外されノートが付く", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
    ];
    const stale: CurrentAssignmentInput[] = [
      {
        event_day_slot_id: "m1",
        match_phase: "morning",
        assignment_type: "morning_fixed",
        reservation_a_id: "ghost-a",
        reservation_b_id: "ghost-b",
        referee_reservation_id: null,
        warning_json: [],
      },
    ];
    const reservations = [
      strongRes("r1", "m2"),
      strongRes("r2", "m2"),
      strongRes("r3", "m1"),
    ];
    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: stale,
    });
    expect(result.meta.notes.some((n) => n.includes("morning_fixed") && n.includes("除外"))).toBe(
      true
    );
    expect(result.assignments.some((r) => r.assignment_type === "morning_fixed")).toBe(false);
    expect(result.assignments.filter((r) => r.match_phase === "morning").length).toBeGreaterThan(0);
  });

  it("審判として参照される morning_fixed の referee が active にいないと行ごと除外", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
    ];
    const stale: CurrentAssignmentInput[] = [
      {
        event_day_slot_id: "m1",
        match_phase: "morning",
        assignment_type: "morning_fixed",
        reservation_a_id: "r1",
        reservation_b_id: "r2",
        referee_reservation_id: "ref-ghost",
        warning_json: [],
      },
    ];
    const reservations = [strongRes("r1", "m1"), strongRes("r2", "m1")];
    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: stale,
    });
    expect(result.assignments.some((r) => r.assignment_type === "morning_fixed")).toBe(false);
    expect(result.meta.notes.some((n) => n.includes("morning_fixed") && n.includes("除外"))).toBe(
      true
    );
  });

  it("午前 active が1枠のみ・チーム3: 午前未ペアが残りうる（unfilledMorning）", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
    ];
    const reservations = [
      strongRes("a", "m1"),
      strongRes("b", "m1"),
      strongRes("c", "m1"),
    ];
    const result = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expect(result.meta.unfilledMorningReservationIds.length).toBeGreaterThanOrEqual(1);
    expect(result.meta.notes.some((n) => n.includes("午前未ペア"))).toBe(true);
    const morningRows = result.assignments.filter((r) => r.match_phase === "morning");
    expect(morningRows.length).toBeLessThanOrEqual(1);
    for (const r of result.assignments) {
      expect(r.reservation_a_id).not.toBe(r.reservation_b_id);
    }
  });

  it("午前のみ・チーム5・枠2のみ: 午前未ペアと target 短が出やすい構成を許容し二重枠割当は無い", () => {
    const morningSlots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const reservations = ["v1", "v2", "v3", "v4", "v5"].map((id, i) =>
      strongRes(id, morningSlots[i % 2]!.id)
    );
    const result = buildMatchingAssignments({
      slots: morningSlots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    const bySlot = new Map<string, RpcAssignmentRow[]>();
    for (const r of result.assignments) {
      if (!bySlot.has(r.event_day_slot_id)) bySlot.set(r.event_day_slot_id, []);
      bySlot.get(r.event_day_slot_id)!.push(r);
    }
    for (const [, rows] of bySlot) {
      expect(rows.length).toBeLessThanOrEqual(1);
    }
    expect(
      result.meta.unfilledMorningReservationIds.length > 0 ||
        result.meta.targetPlayShortfallReservationIds.length > 0
    ).toBe(true);
  });

  it("strong1 + potential 多数: 異カが必ずどこかに入る（既存観点の境界寄り）", () => {
    const morningSlots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const afternoonSlots: SlotRow[] = [1, 2, 3].map((i) => ({
      id: `af${i}`,
      slot_code: `AF${i}`,
      phase: "afternoon" as const,
      is_active: true,
    }));
    const slots = [...morningSlots, ...afternoonSlots];
    const reservations = [
      strongRes("s1", "m1"),
      potentialRes("p1", "m1"),
      potentialRes("p2", "m2"),
      potentialRes("p3", "m2"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    const hasCross = result.assignments.some((r) => r.warning_json.includes("cross_category_match"));
    expect(hasCross).toBe(true);
    const ids = ["s1", "p1", "p2", "p3"];
    const vals = ids.map((id) => playCounts(result.assignments, ids).get(id) ?? 0);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("inactive 枠には行が付かない（6枠テンプレで m4/a4）", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
      { id: "m3", slot_code: "M3", phase: "morning", is_active: true },
      { id: "m4", slot_code: "M4", phase: "morning", is_active: false },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
      { id: "a3", slot_code: "A3", phase: "afternoon", is_active: true },
      { id: "a4", slot_code: "A4", phase: "afternoon", is_active: false },
    ];
    const reservations = [strongRes("t1", "m1"), strongRes("t2", "m2"), strongRes("t3", "m3")];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expect(result.assignments.some((r) => r.event_day_slot_id === "m4" || r.event_day_slot_id === "a4")).toBe(false);
    for (const s of slots.filter((x) => x.is_active === false)) {
      expect(result.assignments.filter((r) => r.event_day_slot_id === s.id)).toHaveLength(0);
    }
  });
});
