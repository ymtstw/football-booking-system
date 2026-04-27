/** 予約確認コード（短い英数字）。紛らわしい 0,O,1,I,L は使わない。 */

import { randomBytes } from "crypto";

/** Crockford 風 31 文字（0,1,O,I,L 除外）。大文字。 */
export const CONFIRMATION_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const RAW_LEN = 16;
const ALPH_LEN = CONFIRMATION_CODE_ALPHABET.length;

/** 16 文字の正規形（ハイフンなし・大文字） */
export function generateReservationConfirmationRaw(): string {
  let out = "";
  while (out.length < RAW_LEN) {
    const b = randomBytes(1)[0]!;
    // バイアス除去: 256 % n 未満のみ採用
    if (b < 256 - (256 % ALPH_LEN)) {
      out += CONFIRMATION_CODE_ALPHABET[b % ALPH_LEN]!;
    }
  }
  return out;
}

/** 表示用: 4 文字ごとにハイフン */
export function formatReservationConfirmationDisplay(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  const parts: string[] = [];
  for (let i = 0; i < compact.length; i += 4) {
    parts.push(compact.slice(i, i + 4));
  }
  return parts.join("-");
}

/** 正規形か（16 文字・許容アルファベットのみ） */
export function isValidReservationConfirmationRaw(compactUpper: string): boolean {
  if (compactUpper.length !== RAW_LEN) return false;
  for (let i = 0; i < compactUpper.length; i++) {
    if (!CONFIRMATION_CODE_ALPHABET.includes(compactUpper[i]!)) return false;
  }
  return true;
}
