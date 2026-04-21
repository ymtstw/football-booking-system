import { describe, expect, it } from "vitest";

import {
  buildMatchingAssignments,
  type BuildMatchingMeta,
  type RpcAssignmentRow,
  type SlotRow,
} from "@/domains/matching/build-matching-assignments";

type ReservationInput = Parameters<typeof buildMatchingAssignments>[0]["reservationsActive"][number];

/** 強さ・代表学年を明示した予約（欠損は実装側で potential / null 扱い） */
function res(
  id: string,
  morningSlotId: string | null,
  strength: "strong" | "potential",
  grade: number
): ReservationInput {
  return {
    id,
    selected_morning_slot_id: morningSlotId,
    team_id: `team-${id}`,
    teams: { strength_category: strength, representative_grade_year: grade },
  };
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

function afternoonRows(assignments: RpcAssignmentRow[]): RpcAssignmentRow[] {
  return assignments.filter((r) => r.match_phase === "afternoon");
}

/** 午後行に `cross_category_match` が付かない（同カで足りる局面の検証用） */
function expectAfternoonNoCrossCategory(assignments: RpcAssignmentRow[]): void {
  for (const row of afternoonRows(assignments)) {
    expect(row.warning_json).not.toContain("cross_category_match");
  }
}

/** 午後の少なくとも1行に `cross_category_match`（やむを得ない混在の検証用） */
function expectAfternoonHasCrossCategory(assignments: RpcAssignmentRow[]): void {
  expect(
    afternoonRows(assignments).some((r) => r.warning_json.includes("cross_category_match"))
  ).toBe(true);
}

/** 全日編成が成立した日の meta.notes / 不足系（仕様どおりの最低限） */
function expectMetaHealthyFilledDay(meta: BuildMatchingMeta, _activeCount: number): void {
  expect(meta.unfilledAfternoonReservationIds).toEqual([]);
  expect(meta.targetPlayShortfallReservationIds).toEqual([]);
  const dayTargetNote = meta.notes.find((n) => n.startsWith("全日目標出場:"));
  expect(dayTargetNote).toBeTruthy();
  expect(dayTargetNote!.includes("全員") || dayTargetNote!.includes("base")).toBe(true);
  expect(meta.notes.some((n) => n.includes("午後に1試合も付かなかった"))).toBe(false);
  expect(meta.notes.some((n) => n.includes("targetPlayShortfallReservationIds"))).toBe(false);
}

/** 代表学年の差（テスト側の期待用。実装の gradeYearPairDistance と同じ定義） */
function gradeGap(assignments: RpcAssignmentRow[], byId: Map<string, ReservationInput>, a: string, b: string): number {
  const ga = byId.get(a)?.teams?.representative_grade_year;
  const gb = byId.get(b)?.teams?.representative_grade_year;
  if (typeof ga !== "number" || typeof gb !== "number") return 0;
  return Math.abs(ga - gb);
}

type SlotFactory = () => SlotRow[];

describe.each<[string, SlotFactory]>([
  ["6枠日", slotsSix],
  ["8枠日", slotsEight],
])("午後自動編成 / カテゴリ・学年・警告（%s）", (label, makeSlots) => {
  it("同カテゴリ（potential のみ）なら午後に cross_category_match を付けない", () => {
    const slots = makeSlots();
    const reservations = [
      res("p1", "m1", "potential", 2),
      res("p2", "m1", "potential", 6),
      res("p3", "m2", "potential", 3),
      res("p4", "m2", "potential", 5),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonNoCrossCategory(assignments);
    expectMetaHealthyFilledDay(meta, reservations.length);
    for (const row of afternoonRows(assignments)) {
      expect(row.warning_json.some((w) => w.startsWith("afternoon_pair_pick_tier_"))).toBe(true);
    }
  });

  it("同カテゴリ（strong のみ）なら午後に cross_category_match を付けない", () => {
    const slots = makeSlots();
    const reservations = [
      res("s1", "m1", "strong", 2),
      res("s2", "m1", "strong", 6),
      res("s3", "m2", "strong", 3),
      res("s4", "m2", "strong", 5),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonNoCrossCategory(assignments);
    expectMetaHealthyFilledDay(meta, reservations.length);
  });

  it("強さが揃う候補がある局面では strong-strong / potential-potential を優先し cross_category を避ける（2+2）", () => {
    const slots = makeSlots();
    const hasFourthMorning = slots.some((s) => s.id === "m4" && s.phase === "morning" && s.is_active !== false);
    const reservations = [
      res("s1", "m1", "strong", 3),
      res("s2", "m2", "strong", 3),
      res("p1", "m3", "potential", 4),
      res("p2", hasFourthMorning ? "m4" : "m3", "potential", 4),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    // 8枠は全日で同カのみで足りる想定。6枠は午後本数がタイトで第2巡（afternoon_second_round_fill）に
    // 強さ混在が入り得るため、第1巡分のみ cross を禁止する。
    if (label === "8枠日") {
      expectAfternoonNoCrossCategory(assignments);
    } else {
      const phase1Af = afternoonRows(assignments).filter((r) => !r.warning_json.includes("afternoon_second_round_fill"));
      for (const row of phase1Af) {
        expect(row.warning_json).not.toContain("cross_category_match");
      }
    }
    expectMetaHealthyFilledDay(meta, reservations.length);
  });

  it("学年が近い辺を優先する（同一強さ・初午後カバレッジ等が揃う辺同士で学年差が小さい方が選ばれる）", () => {
    const slots = makeSlots();
    const reservations = [
      res("a", "m1", "strong", 3),
      res("b", "m1", "strong", 5),
      res("c", "m2", "strong", 3),
      res("d", "m2", "strong", 5),
    ];
    const byId = new Map(reservations.map((r) => [r.id, r] as const));
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonNoCrossCategory(assignments);
    expectMetaHealthyFilledDay(meta, reservations.length);
    const gaps = afternoonRows(assignments).map((row) =>
      gradeGap(assignments, byId, row.reservation_a_id, row.reservation_b_id)
    );
    expect(gaps.some((g) => g === 0)).toBe(true);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2);
  });

  it("強さ混在かつ学年混在: 午後に cross_category が付きうるが編成は成立する", () => {
    const slots = makeSlots();
    const reservations = [
      res("st", "m1", "strong", 6),
      res("p1", "m1", "potential", 2),
      res("p2", "m2", "potential", 3),
      res("p3", "m2", "potential", 4),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonHasCrossCategory(assignments);
    expectMetaHealthyFilledDay(meta, reservations.length);
  });

  it("同カでは奇数カテゴリのため避けられない: 午後に cross_category_match が付く（1 strong + 3 potential）", () => {
    const slots = makeSlots();
    const reservations = [
      res("st", "m1", "strong", 3),
      res("p1", "m1", "potential", 4),
      res("p2", "m2", "potential", 4),
      res("p3", "m2", "potential", 4),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonHasCrossCategory(assignments);
    expectMetaHealthyFilledDay(meta, reservations.length);
    const crossRows = afternoonRows(assignments).filter((r) => r.warning_json.includes("cross_category_match"));
    expect(crossRows.length).toBeGreaterThan(0);
    for (const row of crossRows) {
      expect(row.warning_json.some((w) => w.startsWith("afternoon_pair_pick_tier_"))).toBe(true);
    }
  });
});

describe("午後自動編成 / カテゴリ境界（枠数固定の小構成）", () => {
  it("4枠日・2午前+2午後: strong 奇数では cross_category が避けられない", () => {
    const slots: SlotRow[] = [
      { id: "m1", slot_code: "M1", phase: "morning", is_active: true },
      { id: "m2", slot_code: "M2", phase: "morning", is_active: true },
      { id: "a1", slot_code: "A1", phase: "afternoon", is_active: true },
      { id: "a2", slot_code: "A2", phase: "afternoon", is_active: true },
    ];
    const reservations = [
      res("st", "m1", "strong", 3),
      res("p1", "m1", "potential", 4),
      res("p2", "m2", "potential", 4),
      res("p3", "m2", "potential", 4),
    ];
    const { assignments, meta } = buildMatchingAssignments({
      slots,
      reservationsActive: reservations,
      currentAssignments: [],
    });
    expectAfternoonHasCrossCategory(assignments);
    expect(meta.unfilledAfternoonReservationIds).toEqual([]);
    expect(meta.targetPlayShortfallReservationIds).toEqual([]);
    expect(meta.notes.some((n) => n.startsWith("全日目標出場:"))).toBe(true);
  });
});
