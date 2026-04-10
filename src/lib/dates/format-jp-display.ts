/** 開催日などの日本語向け表示（曜日は Asia/Tokyo）。 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` → `2026-04-18（土）` */
export function formatIsoDateWithWeekdayJa(yyyyMmDd: string): string {
  const s = yyyyMmDd.trim();
  if (!ISO_DATE.test(s)) return s;
  const instant = new Date(`${s}T12:00:00+09:00`);
  if (Number.isNaN(instant.getTime())) return s;
  const wd = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(instant);
  return `${s}（${wd}）`;
}

/** ISO 日時を東京の日付＋時分（秒なし）表記の末尾に曜日（短）を付与 */
export function formatDateTimeTokyoWithWeekday(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const base = new Intl.DateTimeFormat("ja-JP", opts).format(dt);
  const wd = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(dt);
  return `${base}（${wd}）`;
}
