/**
 * 昼食メニュー「表示順」入力用。
 * 半角数字のみ（空は 0）、負数・小数・指数表記は不可。
 */

/** FormData の値や文字列から表示順を解釈。不正なら null。 */
export function parseSortOrderInput(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).trim();
  if (s === "") return 0;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

/** number input で -・e・小数点などを打てないようにする（React / DOM 両対応） */
export function preventInvalidSortOrderKeyDown(e: {
  key: string;
  preventDefault(): void;
}): void {
  const k = e.key;
  if (k === "-" || k === "+" || k === "e" || k === "E" || k === "." || k === ",") {
    e.preventDefault();
  }
}
