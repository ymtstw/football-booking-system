/** 予約番号 RSV-xxxxxx（認証には使わない表示・検索用ラベル） */

import { randomBytes } from "crypto";

const BODY_LEN = 6;
const ALPH = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const N = ALPH.length;

/** RSV- + 6 文字。衝突時は呼び出し側で再試行する。 */
export function generateReservationPublicRef(): string {
  let body = "";
  while (body.length < BODY_LEN) {
    const b = randomBytes(1)[0]!;
    if (b < 256 - (256 % N)) {
      body += ALPH[b % N]!;
    }
  }
  return `RSV-${body}`;
}
