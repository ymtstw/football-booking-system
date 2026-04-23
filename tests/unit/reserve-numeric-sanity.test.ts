import { describe, expect, it } from "vitest";

import {
  isAtLeastFourDigitCount,
  RESERVE_COUNT_MAX_ALLOWED,
  RESERVE_COUNT_REJECT_FROM,
} from "@/lib/reservations/reserve-numeric-sanity";

describe("reserve-numeric-sanity", () => {
  it("閾値: 999 までは false、1000 以上は true", () => {
    expect(RESERVE_COUNT_REJECT_FROM).toBe(1000);
    expect(RESERVE_COUNT_MAX_ALLOWED).toBe(999);
    expect(isAtLeastFourDigitCount(999)).toBe(false);
    expect(isAtLeastFourDigitCount(1000)).toBe(true);
    expect(isAtLeastFourDigitCount(10000)).toBe(true);
  });

  it("整数以外は false", () => {
    expect(isAtLeastFourDigitCount(999.7)).toBe(false);
    expect(isAtLeastFourDigitCount(Number.NaN)).toBe(false);
  });
});
