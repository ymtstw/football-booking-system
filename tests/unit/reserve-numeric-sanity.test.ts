import { describe, expect, it } from "vitest";

import {
  exceedsReserveCountMaxAllowed,
  RESERVE_COUNT_MAX_ALLOWED,
  RESERVE_COUNT_REJECT_FROM,
} from "@/lib/reservations/reserve-numeric-sanity";

describe("reserve-numeric-sanity", () => {
  it("閾値: 9999 までは false、10000 以上は true", () => {
    expect(RESERVE_COUNT_REJECT_FROM).toBe(10000);
    expect(RESERVE_COUNT_MAX_ALLOWED).toBe(9999);
    expect(exceedsReserveCountMaxAllowed(9999)).toBe(false);
    expect(exceedsReserveCountMaxAllowed(10000)).toBe(true);
    expect(exceedsReserveCountMaxAllowed(99999)).toBe(true);
  });

  it("整数以外は false", () => {
    expect(exceedsReserveCountMaxAllowed(9999.7)).toBe(false);
    expect(exceedsReserveCountMaxAllowed(Number.NaN)).toBe(false);
  });
});
