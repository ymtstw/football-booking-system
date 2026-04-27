/** 予約確認コード正規形の SHA-256 hex（64 文字・切り詰めなし）。サーバーのみ。 */
import "server-only";

import { createHash } from "crypto";

import { normalizeReservationTokenPlain } from "./token-format";

/** POST 作成時と同じ SHA-256 hex。入力は正規化してからハッシュ。 */
export function hashReservationTokenPlain(plain: string): string {
  return createHash("sha256")
    .update(normalizeReservationTokenPlain(plain), "utf8")
    .digest("hex");
}
