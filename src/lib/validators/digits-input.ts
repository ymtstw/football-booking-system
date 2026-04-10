/**
 * フォーム用: 電話・人数などの数字入力を半角 0-9 のみにする。
 * 全角数字（０-９）は半角に直し、それ以外の文字は除去する。
 * （Unicode の別体系の数字は MVP では未対応。必要なら拡張する）
 */
export function inputAsciiDigitsOnly(raw: string): string {
  let out = "";
  for (const c of raw) {
    const cp = c.codePointAt(0)!;
    if (cp >= 0xff10 && cp <= 0xff19) {
      out += String.fromCharCode(cp - 0xff10 + 0x30);
      continue;
    }
    if (c >= "0" && c <= "9") {
      out += c;
    }
  }
  return out;
}
