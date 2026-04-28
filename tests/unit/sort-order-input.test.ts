import { describe, expect, it } from "vitest";

import { parseSortOrderInput } from "@/lib/lunch/sort-order-input";

describe("parseSortOrderInput", () => {
  it("空・未指定は 0", () => {
    expect(parseSortOrderInput(undefined)).toBe(0);
    expect(parseSortOrderInput(null)).toBe(0);
    expect(parseSortOrderInput("")).toBe(0);
    expect(parseSortOrderInput("   ")).toBe(0);
  });

  it("半角数字のみ許可", () => {
    expect(parseSortOrderInput("0")).toBe(0);
    expect(parseSortOrderInput("12")).toBe(12);
    expect(parseSortOrderInput("001")).toBe(1);
  });

  it("負数・全角・記号は null", () => {
    expect(parseSortOrderInput("-1")).toBeNull();
    expect(parseSortOrderInput("１")).toBeNull();
    expect(parseSortOrderInput("1.5")).toBeNull();
    expect(parseSortOrderInput("1e2")).toBeNull();
    expect(parseSortOrderInput("abc")).toBeNull();
  });
});
