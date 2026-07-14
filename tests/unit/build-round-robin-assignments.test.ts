import { describe, expect, it } from "vitest";

import { buildRoundRobinAssignments } from "@/domains/matching/build-round-robin-assignments";

describe("buildRoundRobinAssignments", () => {
  const slots = [
    { id: "s1", slot_code: "MORNING_1", phase: "morning" as const, is_active: true },
    { id: "s2", slot_code: "MORNING_2", phase: "morning" as const, is_active: true },
    { id: "s3", slot_code: "MORNING_3", phase: "morning" as const, is_active: true },
    { id: "s4", slot_code: "MORNING_4", phase: "morning" as const, is_active: true },
    { id: "s5", slot_code: "MORNING_5", phase: "morning" as const, is_active: true },
    { id: "s6", slot_code: "MORNING_6", phase: "morning" as const, is_active: true },
  ];

  it("4チームで6枠: 全6試合を割当し試合数差は最大1", () => {
    const reservations = [
      { id: "r-a" },
      { id: "r-b" },
      { id: "r-c" },
      { id: "r-d" },
    ];
    const result = buildRoundRobinAssignments({ slots, reservationsActive: reservations });
    expect(result.assignments).toHaveLength(6);
    expect(result.assignments.every((a) => a.assignment_type === "round_robin")).toBe(true);

    const play = new Map<string, number>();
    for (const id of ["r-a", "r-b", "r-c", "r-d"]) play.set(id, 0);
    for (const row of result.assignments) {
      play.set(row.reservation_a_id, (play.get(row.reservation_a_id) ?? 0) + 1);
      play.set(row.reservation_b_id, (play.get(row.reservation_b_id) ?? 0) + 1);
      expect([row.reservation_a_id, row.reservation_b_id]).toContain(
        row.referee_reservation_id
      );
    }
    const counts = [...play.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("3チームで6枠: 再戦で枠を埋める", () => {
    const reservations = [{ id: "r-a" }, { id: "r-b" }, { id: "r-c" }];
    const result = buildRoundRobinAssignments({ slots, reservationsActive: reservations });
    expect(result.assignments).toHaveLength(6);
    expect(result.assignments.some((a) => a.warning_json.includes("rematch"))).toBe(true);
  });

  it("active が1件なら編成しない", () => {
    const result = buildRoundRobinAssignments({
      slots,
      reservationsActive: [{ id: "r-a" }],
    });
    expect(result.assignments).toHaveLength(0);
  });
});
