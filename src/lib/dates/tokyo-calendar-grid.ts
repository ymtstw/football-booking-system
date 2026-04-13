/** 開催日カレンダー用。日付はカレンダー日として Asia/Tokyo（正午+09:00 で曖昧さを避ける）。 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 指定年月の日数（1-based month） */
export function daysInMonthTokyo(year: number, month: number): number {
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  const start = Date.parse(`${year}-${pad2(month)}-01T12:00:00+09:00`);
  const end = Date.parse(`${nextY}-${pad2(nextM)}-01T12:00:00+09:00`);
  return Math.round((end - start) / 86400000);
}

/** その日が東京で何曜か。日曜 = 0 … 土曜 = 6 */
export function sunday0WeekdayTokyo(year: number, month: number, dayOfMonth: number): number {
  const iso = `${year}-${pad2(month)}-${pad2(dayOfMonth)}`;
  const instant = new Date(`${iso}T12:00:00+09:00`);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

export type CalendarCell = { kind: "day"; isoDate: string; inCurrentMonth: boolean };

const WEEKDAY_HEADERS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function weekdayHeadersJa(): readonly string[] {
  return WEEKDAY_HEADERS_JA;
}

/**
 * 6 行 × 7 列のグリッド。先頭は当月1日の左に前月日を埋め、末尾は翌月で埋める。
 */
export function buildMonthGrid6Rows(year: number, month: number): CalendarCell[] {
  const dim = daysInMonthTokyo(year, month);
  const lead = sunday0WeekdayTokyo(year, month, 1);
  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const dimPrev = daysInMonthTokyo(prevY, prevM);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) {
    const dom = dimPrev - lead + i + 1;
    cells.push({
      kind: "day",
      isoDate: `${prevY}-${pad2(prevM)}-${pad2(dom)}`,
      inCurrentMonth: false,
    });
  }
  for (let dom = 1; dom <= dim; dom++) {
    cells.push({
      kind: "day",
      isoDate: `${year}-${pad2(month)}-${pad2(dom)}`,
      inCurrentMonth: true,
    });
  }
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  let nextDom = 1;
  while (cells.length < 42) {
    cells.push({
      kind: "day",
      isoDate: `${nextY}-${pad2(nextM)}-${pad2(nextDom)}`,
      inCurrentMonth: false,
    });
    nextDom += 1;
  }
  return cells;
}

/** 東京の「いま」の暦年・月（1-based） */
export function tokyoYearMonthNow(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: y, month: m };
}

/** 東京の「いま」の暦日 `YYYY-MM-DD` */
export function tokyoIsoDateToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  const fallback = new Date();
  return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
}

/** カレンダー日（東京正午基準）に日数を加算した `YYYY-MM-DD` */
export function addDaysIsoDate(isoDate: string, deltaDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const ms = Date.parse(`${isoDate}T12:00:00+09:00`) + deltaDays * 86400000;
  if (Number.isNaN(ms)) return isoDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  return isoDate;
}

/** 開催日の最も早い日がある月を表示用の初期値に */
export function initialYearMonthFromEvents(
  eventDatesIso: readonly string[]
): { year: number; month: number } {
  const sorted = [...eventDatesIso].filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
  if (sorted.length === 0) return tokyoYearMonthNow();
  const first = sorted[0]!;
  const [y, m] = first.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return tokyoYearMonthNow();
  return { year: y, month: m };
}
