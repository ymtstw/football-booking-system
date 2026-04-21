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

function afternoonRows(assignments: RpcAssignmentRow[]): RpcAssignmentRow[] {
  return assignments.filter((r) => r.match_phase === "afternoon");
}

/** 同一午後枠に同一予約が二重（a=b または同一枠に同一 id が複数行）しない */
function expectAfternoonSlotAssignmentIntegrity(assignments: RpcAssignmentRow[]): void {
  const af = afternoonRows(assignments);
  const bySlot = new Map<string, RpcAssignmentRow[]>();
  for (const r of af) {
    if (!bySlot.has(r.event_day_slot_id)) bySlot.set(r.event_day_slot_id, []);
    bySlot.get(r.event_day_slot_id)!.push(r);
  }
  for (const [slotId, rows] of bySlot) {
    expect(rows.length, `午後枠 ${slotId} は高々1試合行`).toBeLessThanOrEqual(1);
    for (const r of rows) {
      expect(r.reservation_a_id).not.toBe(r.reservation_b_id);
    }
  }
}

/** 6枠日: 午前3 + 午後3 active */
function slotsSix(): SlotRow[] {
  return [
    { id: "m1", slot_code: "MORNING_1", phase: "morning", is_active: true },
    { id: "m2", slot_code: "MORNING_2", phase: "morning", is_active: true },
    { id: "m3", slot_code: "MORNING_3", phase: "morning", is_active: true },
    { id: "m4", slot_code: "MORNING_4", phase: "morning", is_active: false },
    { id: "a1", slot_code: "AFTERNOON_1", phase: "afternoon", is_active: true },
    { id: "a2", slot_code: "AFTERNOON_2", phase: "afternoon", is_active: true },
    { id: "a3", slot_code: "AFTERNOON_3", phase: "afternoon", is_active: true },
    { id: "a4", slot_code: "AFTERNOON_4", phase: "afternoon", is_active: false },
  ];
}

/** 8枠日: 午前4 + 午後4 active */
function slotsEight(): SlotRow[] {
  return [
    { id: "m1", slot_code: "MORNING_1", phase: "morning", is_active: true },
    { id: "m2", slot_code: "MORNING_2", phase: "morning", is_active: true },
    { id: "m3", slot_code: "MORNING_3", phase: "morning", is_active: true },
    { id: "m4", slot_code: "MORNING_4", phase: "morning", is_active: true },
    { id: "a1", slot_code: "AFTERNOON_1", phase: "afternoon", is_active: true },
    { id: "a2", slot_code: "AFTERNOON_2", phase: "afternoon", is_active: true },
    { id: "a3", slot_code: "AFTERNOON_3", phase: "afternoon", is_active: true },
    { id: "a4", slot_code: "AFTERNOON_4", phase: "afternoon", is_active: true },
  ];
}

describe("午後自動編成 / 6枠・境界と meta", () => {
  it("3チーム: 午前希望が偏っても全 active 枠が埋まり meta の午後系は空", () => {
    const slots = slotsSix();
    const reservations = [
      strongRes("t1", "m1"),
      strongRes("t2", "m1"),
      strongRes("t3", "m2"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    for (const s of slots.filter((x) => x.is_active !== false)) {
      expect(result.assignments.some((r) => r.event_day_slot_id === s.id)).toBe(true);
    }
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });

  it("4チーム: M1×2+M2×2 の偏りでも午後が破綻せず枠整合と meta が良好", () => {
    const slots = slotsSix();
    const reservations = [
      strongRes("r1", "m1"),
      strongRes("r2", "m1"),
      strongRes("r3", "m2"),
      strongRes("r4", "m2"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
    const ids = ["r1", "r2", "r3", "r4"];
    const vals = ids.map((id) => playCounts(result.assignments, ids).get(id) ?? 0);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("5チーム: 偏り配置でも午後ゼロ・target 不足なし", () => {
    const slots = slotsSix();
    const reservations = [
      strongRes("a", "m1"),
      strongRes("b", "m1"),
      strongRes("c", "m2"),
      strongRes("d", "m2"),
      strongRes("e", "m3"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });

  it("6チーム: 午前各2希望でも午後3枠と整合し二重枠割当なし", () => {
    const slots = slotsSix();
    const reservations = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id, i) =>
      strongRes(id, i < 2 ? "m1" : i < 4 ? "m2" : "m3")
    );
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });

  it("午後枠が0本のとき: 全員 unfilledAfternoon・ノートが付く（target は午前だけで充足し得る）", () => {
    const morningOnly: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
      { id: "m3", slot_code: "M3", phase: "morning", is_active: true },
    ];
    const reservations = [strongRes("x", "m1"), strongRes("y", "m2"), strongRes("z", "m3")];
    const result = buildMatchingAssignments({
      slots: morningOnly,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expect(afternoonRows(result.assignments)).toHaveLength(0);
    expect(result.meta.unfilledAfternoonReservationIds.sort()).toEqual(["x", "y", "z"].sort());
    expect(result.meta.notes.some((n) => n.includes("午後に1試合も付かなかった"))).toBe(true);
  });

  it("morning_fixed 後に午後を再計算: 幽霊除外後も午後が成立し二重枠なし", () => {
    const slots = slotsSix();
    const current: CurrentAssignmentInput[] = [
      {
        event_day_slot_id: "m1",
        match_phase: "morning",
        assignment_type: "morning_fixed",
        reservation_a_id: "f1",
        reservation_b_id: "f2",
        referee_reservation_id: null,
        warning_json: [],
      },
    ];
    const reservations = [
      strongRes("f1", "m1"),
      strongRes("f2", "m1"),
      strongRes("u1", "m2"),
      strongRes("u2", "m2"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: current });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.assignments.some((r) => r.assignment_type === "morning_fixed")).toBe(true);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
  });
});

describe("午後自動編成 / 8枠・境界と meta", () => {
  it("3チーム・午前分散: 午後4枠で meta 良好・枠整合", () => {
    const slots = slotsEight();
    const reservations = [
      strongRes("u1", "m1"),
      strongRes("u2", "m2"),
      strongRes("u3", "m3"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });

  it("5チーム・偏り: 午後が成立し target 不足なし", () => {
    const slots = slotsEight();
    const reservations = [
      strongRes("q1", "m1"),
      strongRes("q2", "m1"),
      strongRes("q3", "m2"),
      strongRes("q4", "m2"),
      strongRes("q5", "m3"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });

  it("7チーム: 多チームでも午後 meta が異常にならない（枠整合）", () => {
    const slots = slotsEight();
    const reservations = [
      strongRes("h1", "m1"),
      strongRes("h2", "m1"),
      strongRes("h3", "m2"),
      strongRes("h4", "m2"),
      strongRes("h5", "m3"),
      strongRes("h6", "m3"),
      strongRes("h7", "m4"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(result.meta.targetPlayShortfallReservationIds).toEqual([]);
  });
});

describe("午後自動編成 / 打ち切り・再戦・実装整合", () => {
  it("午後枠1本・6チーム（午前なし）: 起票2人以外は unfilledAfternoon・枠整合は維持", () => {
    const afternoonSlots: SlotRow[] = [
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
    ];
    const reservations = Array.from({ length: 6 }, (_, i) => strongRes(`six-${i}`, null));
    const result = buildMatchingAssignments({
      slots: afternoonSlots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expect(afternoonRows(result.assignments)).toHaveLength(1);
    const inAfternoon = new Set<string>();
    for (const row of afternoonRows(result.assignments)) {
      inAfternoon.add(row.reservation_a_id);
      inAfternoon.add(row.reservation_b_id);
    }
    expect(inAfternoon.size).toBe(2);
    expect(result.meta.unfilledAfternoonReservationIds).toHaveLength(4);
    for (const r of reservations) {
      if (!inAfternoon.has(r.id)) {
        expect(result.meta.unfilledAfternoonReservationIds).toContain(r.id);
      }
    }
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
    expect(result.meta.notes.some((n) => n.includes("午後に1試合も付かなかった"))).toBe(true);
  });

  it("morning_fixed で午前に当たったペアは午後再戦で duplicate_opponent が付きうる", () => {
    const morningSlots: SlotRow[] = [{ id: "m1", slot_code: "M1", phase: "morning", is_active: true }];
    const afternoonSlots: SlotRow[] = [
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
    ];
    const slots = [...morningSlots, ...afternoonSlots];
    const current: CurrentAssignmentInput[] = [
      {
        event_day_slot_id: "m1",
        match_phase: "morning",
        assignment_type: "morning_fixed",
        reservation_a_id: "am",
        reservation_b_id: "bm",
        referee_reservation_id: null,
        warning_json: [],
      },
    ];
    const reservations = [strongRes("am", "m1"), strongRes("bm", "m1")];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: current });
    const dupAf = afternoonRows(result.assignments).filter((r) => r.warning_json.includes("duplicate_opponent"));
    expect(dupAf.length).toBeGreaterThanOrEqual(1);
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
  });

  it("強さ混在4チーム: 午後で cross_category が付きうる（偏り許容の検知）", () => {
    const morningSlots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
    ];
    const afternoonSlots: SlotRow[] = [
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
    ];
    const slots = [...morningSlots, ...afternoonSlots];
    const reservations = [
      strongRes("st", "m1"),
      potentialRes("p1", "m1"),
      potentialRes("p2", "m2"),
      potentialRes("p3", "m2"),
    ];
    const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
    expect(result.assignments.some((r) => r.warning_json.includes("cross_category_match"))).toBe(true);
    expectAfternoonSlotAssignmentIntegrity(result.assignments);
  });
});
