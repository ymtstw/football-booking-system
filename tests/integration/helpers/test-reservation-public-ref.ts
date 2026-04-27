import { randomBytes } from "node:crypto";

/** 結合テスト用の一意な予約番号（RSV- + 6 文字の hex 大文字） */
export function testReservationPublicRef(): string {
  return `RSV-${randomBytes(3).toString("hex").toUpperCase()}`;
}
