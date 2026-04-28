/**
 * 予約番号（DB・API では `RSV-` + 英数字6文字。認証には使わない表示用ラベル）。
 */

import { randomBytes } from "crypto";

const BODY_LEN = 6;
const ALPH = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const N = ALPH.length;

const PUBLIC_REF_PREFIX = /^RSV-/i;

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

/** 画面・メール向け: 先頭の `RSV-` を除いた本体（お問い合わせで伝えやすい表記）。 */
export function formatReservationPublicRefForDisplay(
  ref: string | null | undefined
): string {
  const s = ref?.trim() ?? "";
  if (!s) return "";
  return s.replace(PUBLIC_REF_PREFIX, "");
}

/**
 * PostgREST の `ilike` に渡すパターン用に、ユーザー入力断片の `%` `_` `\` をエスケープする。
 * 呼び出し側で前後に `%` を付与すること。
 */
export function escapeForPostgresIlikeFragment(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
