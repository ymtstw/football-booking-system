import { describe, expect, it } from "vitest";

import {
  buildMatchingAssignments,
  type RpcAssignmentRow,
  type SlotRow,
} from "@/domains/matching/build-matching-assignments";

/** 6枠運用: 午前3 + 午後3 active（M4/A4 は inactive）— default-slots と同型 */
function slotsSixPattern(): SlotRow[] {
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

/** 8枠運用: 午前4 + 午後4 すべて active */
function slotsEightPattern(): SlotRow[] {
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

/** active 枠ごとに試合行がちょうど1本（空枠不可の正常系） */
function expectEachActiveSlotFilledOnce(
  slots: SlotRow[],
  assignments: { event_day_slot_id: string }[]
): void {
  const active = slots.filter((s) => s.is_active !== false);
  for (const s of active) {
    const rows = assignments.filter((r) => r.event_day_slot_id === s.id);
    expect(rows.length, `slot ${s.id}`).toBe(1);
  }
}

/** 同一試合行で a≠b */
function expectValidPairs(
  assignments: { reservation_a_id: string; reservation_b_id: string }[]
): void {
  for (const r of assignments) {
    expect(r.reservation_a_id).not.toBe(r.reservation_b_id);
  }
}

/** 同一枠に同一予約が二重に載らない（1枠1行なので行内＋、念のため枠集計） */
function expectNoDoubleBookingPerSlot(
  assignments: { event_day_slot_id: string; reservation_a_id: string; reservation_b_id: string }[]
): void {
  const bySlot = new Map<string, Set<string>>();
  for (const r of assignments) {
    if (!bySlot.has(r.event_day_slot_id)) bySlot.set(r.event_day_slot_id, new Set());
    const set = bySlot.get(r.event_day_slot_id)!;
    for (const id of [r.reservation_a_id, r.reservation_b_id]) {
      expect(set.has(id), `double ${id} on slot ${r.event_day_slot_id}`).toBe(false);
      set.add(id);
    }
  }
}

function expectSpreadAtMost1(assignments: RpcAssignmentRow[], ids: string[]): void {
  const counts = playCounts(assignments, ids);
  const vals = ids.map((id) => counts.get(id) ?? 0);
  expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
}

describe("buildMatchingAssignments / 6枠・8枠シナリオ（MT-* 対応）", () => {
  describe("MT-6-302: 6枠・3チーム・午前希望が偏り（M1に2）", () => {
    it("全 active 枠に行が付き target 不足・午後未割当なし", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("t1", "m1"),
        strongRes("t2", "m1"),
        strongRes("t3", "m2"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectValidPairs(result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["t1", "t2", "t3"]);
    });
  });

  describe("MT-6-401 / MT-6-402: 6枠・4チーム・偏りと分散", () => {
    it("MT-6-401: M1×2 + M2×2", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("r1", "m1"),
        strongRes("r2", "m1"),
        strongRes("r3", "m2"),
        strongRes("r4", "m2"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["r1", "r2", "r3", "r4"]);
    });

    it("MT-6-402: M1×2 + M2×1 + M3×1", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("r1", "m1"),
        strongRes("r2", "m1"),
        strongRes("r3", "m2"),
        strongRes("r4", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["r1", "r2", "r3", "r4"]);
    });
  });

  describe("MT-6-501: 6枠・5チーム・2+2+1", () => {
    it("奇数チームでも全日ターゲットと枠埋めを満たす", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("a", "m1"),
        strongRes("b", "m1"),
        strongRes("c", "m2"),
        strongRes("d", "m2"),
        strongRes("e", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["a", "b", "c", "d", "e"]);
    });
  });

  describe("MT-6-601: 6枠・6チーム・午前各2名", () => {
    it("満杯に近い午前でも午後込みで偏り1以内", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("p1", "m1"),
        strongRes("p2", "m1"),
        strongRes("p3", "m2"),
        strongRes("p4", "m2"),
        strongRes("p5", "m3"),
        strongRes("p6", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["p1", "p2", "p3", "p4", "p5", "p6"]);
    });
  });

  describe("MT-6-F01: 6枠・morning_fixed あり + 残り fill", () => {
    it("固定1試合を尊重しつつ残り4チームが編成される", () => {
      const slots = slotsSixPattern();
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
        strongRes("x1", "m2"),
        strongRes("x2", "m2"),
        strongRes("x3", "m3"),
        strongRes("x4", "m3"),
      ];
      const result = buildMatchingAssignments({
        slots,
        reservationsActive: reservations,
        currentAssignments: current,
      });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      const fixedRow = result.assignments.find(
        (r) => r.event_day_slot_id === "m1" && r.assignment_type === "morning_fixed"
      );
      expect(fixedRow?.reservation_a_id).toBe("f1");
      expect(fixedRow?.reservation_b_id).toBe("f2");
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["f1", "f2", "x1", "x2", "x3", "x4"]);
    });
  });

  describe("MT-8-301: 8枠・3チーム・午前分散（M1〜M3）", () => {
    it("午後4枠含め全枠埋まり target 不足なし", () => {
      const slots = slotsEightPattern();
      const reservations = [
        strongRes("u1", "m1"),
        strongRes("u2", "m2"),
        strongRes("u3", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["u1", "u2", "u3"]);
    });
  });

  describe("MT-8-501: 8枠・5チーム・偏り", () => {
    it("2+2+1+0 相当の希望分布で偏り1以内", () => {
      const slots = slotsEightPattern();
      const reservations = [
        strongRes("q1", "m1"),
        strongRes("q2", "m1"),
        strongRes("q3", "m2"),
        strongRes("q4", "m2"),
        strongRes("q5", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["q1", "q2", "q3", "q4", "q5"]);
    });
  });

  describe("MT-8-601: 8枠・6チーム", () => {
    it("M1〜M3 に各2の偏りで全日整合", () => {
      const slots = slotsEightPattern();
      const reservations = [
        strongRes("s1", "m1"),
        strongRes("s2", "m1"),
        strongRes("s3", "m2"),
        strongRes("s4", "m2"),
        strongRes("s5", "m3"),
        strongRes("s6", "m3"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["s1", "s2", "s3", "s4", "s5", "s6"]);
    });
  });

  describe("MT-8-701: 8枠・7チーム", () => {
    it("多チームでも meta 異常なく完了しやすいパターン", () => {
      const slots = slotsEightPattern();
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
      expectEachActiveSlotFilledOnce(slots, result.assignments);
      expectNoDoubleBookingPerSlot(result.assignments);
      expect(result.meta.targetPlayShortfallReservationIds.length).toBe(0);
      expect(result.meta.unfilledAfternoonReservationIds.length).toBe(0);
      expectSpreadAtMost1(result.assignments, ["h1", "h2", "h3", "h4", "h5", "h6", "h7"]);
    });
  });

  describe("MT-X-001: 審判・出場の基本整合", () => {
    it("6枠代表で審判が当事者以外から選ばれる", () => {
      const slots = slotsSixPattern();
      const reservations = [
        strongRes("t1", "m1"),
        strongRes("t2", "m1"),
        strongRes("t3", "m2"),
      ];
      const result = buildMatchingAssignments({ slots, reservationsActive: reservations, currentAssignments: [] });
      for (const row of result.assignments) {
        if (row.referee_reservation_id == null) continue;
        expect(row.referee_reservation_id).not.toBe(row.reservation_a_id);
        expect(row.referee_reservation_id).not.toBe(row.reservation_b_id);
      }
    });
  });
});
