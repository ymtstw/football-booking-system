/** 管理画面 `?around=YYYY-MM-DD` の検証（東京の開催日キー用） */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAroundParam(
  raw: string | string[] | undefined
): string | null {
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
        ? (raw[0]?.trim() ?? "")
        : "";
  if (!ISO_DATE.test(s)) return null;
  const t = Date.parse(`${s}T12:00:00+09:00`);
  if (Number.isNaN(t)) return null;
  return s;
}
