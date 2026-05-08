import { describe, expect, it } from "vitest";

function filterUnresolvedFailed<T extends { resolved_at?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.resolved_at == null);
}

describe("unresolved failed notifications filter", () => {
  it("keeps only rows with resolved_at null/undefined", () => {
    const rows = [
      { id: "a", resolved_at: null },
      { id: "b", resolved_at: undefined },
      { id: "c", resolved_at: "2026-06-01T00:00:00.000Z" },
    ];
    expect(filterUnresolvedFailed(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

