import { createHash } from "node:crypto";

import { normalizeReservationTokenPlain } from "@/lib/reservations/token-format";

/** Route Handler と同じ SHA-256 hex（server-only を避けるためテスト専用）。 */
export function hashReservationTokenPlainForTest(plain: string): string {
  return createHash("sha256")
    .update(normalizeReservationTokenPlain(plain), "utf8")
    .digest("hex");
}
