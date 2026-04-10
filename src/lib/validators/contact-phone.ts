/** 予約フォームの電話番号（DB は text、運用は数字列を想定）。 */

import { inputAsciiDigitsOnly } from "./digits-input";

/** 数字以外を除去した文字列（空は許容し、呼び出し側で必須チェック）。 */
export function normalizeContactPhoneDigits(raw: string): string {
  return inputAsciiDigitsOnly(raw);
}

/** 国内想定で 10〜15 桁（ハイフン除去後）。 */
export function isContactPhoneDigitsValid(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}
