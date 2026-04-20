"use client";

/** SCR-01: 開催日を月カレンダー（7列グリッド）で選択。スマホはコンパクト表示、sm以上は余白多め。 */
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "./_components/reserve-icons";
import { ReserveHeadingWithIcon } from "./_components/ui/reserve-heading-with-icon";

import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { toIsoDateKey } from "@/lib/dates/iso-date-key";
import {
  buildMonthGrid6Rows,
  tokyoYearMonthNow,
  weekdayHeadersJa,
} from "@/lib/dates/tokyo-calendar-grid";
export type EventDayPublic = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
  acceptingReservations: boolean;
  /** GET /api/event-days で付与。受付中のみ数値、それ以外は null */
  morningRemainingVacancies?: number | null;
};

function monthTitleJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

function closedLabelFromStatus(status: string): {
  label: string;
  cancelled: boolean;
} {
  if (status === "cancelled_weather")
    return { label: "雨天中止", cancelled: true };
  if (status === "cancelled_operational")
    return { label: "運営中止", cancelled: true };
  if (status === "cancelled_minimum")
    return { label: "最少未達中止", cancelled: true };
  if (status === "confirmed") return { label: "確定済", cancelled: false };
  if (status === "locked") return { label: "締切後", cancelled: false };
  return { label: "受付終了", cancelled: false };
}

/** grade_band（例: 1-2）をカレンダー用「1-2年」表記に */
function gradeYearsDisplay(gradeBand: string): string {
  const s = gradeBand.trim();
  if (!s) return "—";
  if (s.endsWith("年")) return s;
  return `${s}年`;
}

export function ReserveEventDaysCalendar({
  days,
  initialYearMonth,
  bookableInteraction = "link",
  onBookableDateSelect,
  selectedIsoDate = null,
}: {
  days: EventDayPublic[];
  /** 一覧取得後に最も早い開催日のある月へ合わせる */
  initialYearMonth: { year: number; month: number };
  /** `select` のとき受付中セルは Link ではなくボタン（開催日選択ページ） */
  bookableInteraction?: "link" | "select";
  onBookableDateSelect?: (isoDate: string) => void;
  /** 選択中の日付を強調 */
  selectedIsoDate?: string | null;
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, EventDayPublic>();
    for (const d of days) {
      const key = toIsoDateKey(d.event_date);
      if (key) m.set(key, d);
    }
    return m;
  }, [days]);

  const [viewYear, setViewYear] = useState(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState(initialYearMonth.month);

  const grid = useMemo(
    () => buildMonthGrid6Rows(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function goPrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goThisMonth() {
    const { year, month } = tokyoYearMonthNow();
    setViewYear(year);
    setViewMonth(month);
  }

  const headers = weekdayHeadersJa();

  const hasEventInViewMonth = useMemo(() => {
    const ym = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
    return days.some((d) => {
      const k = toIsoDateKey(d.event_date);
      return k != null && k.startsWith(ym);
    });
  }, [days, viewYear, viewMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ReserveHeadingWithIcon
          as="h2"
          shell="navy"
          icon={<IconCalendar className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.65} />}
          className="min-w-0"
          textClassName="min-w-0 text-lg font-bold text-rp-navy sm:text-xl"
        >
          {monthTitleJa(viewYear, viewMonth)}
        </ReserveHeadingWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rp-mint-2 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-rp-mint/50"
          >
            <IconChevronLeft className="h-4 w-4 text-rp-brand" />
            前の月
          </button>
          <button
            type="button"
            onClick={goThisMonth}
            className="min-h-10 rounded-xl border border-rp-mint-2 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-rp-mint/50"
          >
            今月
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rp-mint-2 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-rp-mint/50"
          >
            次の月
            <IconChevronRight className="h-4 w-4 text-rp-brand" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-rp-mint-2 bg-white shadow-sm">
        <div className="min-w-[280px] p-1.5 sm:min-w-0 sm:p-3">
          <div className="grid grid-cols-7 gap-px bg-rp-mint-2/80">
            {headers.map((h) => (
              <div
                key={h}
                className="bg-rp-mint/90 py-1 text-center text-[10px] font-semibold leading-tight text-rp-navy sm:py-2 sm:text-sm"
              >
                {h}
              </div>
            ))}
            {grid.map((cell, idx) => {
              const { isoDate, inCurrentMonth } = cell;
              const dom = Number(isoDate.slice(8, 10));
              const event = byDate.get(isoDate);
              const hasEvent = Boolean(event);
              const bookable =
                hasEvent && event!.acceptingReservations;

              /** 日付＋学年帯表記＋残枠（受付中）。案内テキストは凡例・aria-label に寄せる */
              const baseCell =
                "flex min-h-[3.15rem] flex-col border border-transparent p-0.5 sm:min-h-[5rem] sm:p-2";

              if (!hasEvent) {
                return (
                  <div
                    key={isoDate + idx}
                    className={`${baseCell} ${
                      inCurrentMonth ? "bg-white" : "bg-zinc-50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium tabular-nums sm:text-base ${
                        inCurrentMonth ? "text-zinc-300" : "text-zinc-200"
                      }`}
                    >
                      {dom}
                    </span>
                  </div>
                );
              }

              const title = `締切: ${formatDateTimeTokyoWithWeekday(
                event!.reservation_deadline_at
              )}`;
              const dayLineJa = formatIsoDateWithWeekdayJa(isoDate);
              const yearsJa = gradeYearsDisplay(event!.grade_band);
              const rem =
                typeof event!.morningRemainingVacancies === "number"
                  ? event!.morningRemainingVacancies
                  : null;
              const remPhrase = rem !== null ? `残り${rem}枠。` : "";
              /** 画面上は「1-2年」等のみ。読み上げ用に日付・学年帯・締切・残枠を明示 */
              const bookableAria = `${dayLineJa}。${yearsJa}（学年帯）。${remPhrase}${title}。`;

              if (bookable) {
                const selected = selectedIsoDate === isoDate;
                const cellClass = `${baseCell} bg-rp-mint ring-1 ring-rp-brand/25 transition-colors hover:bg-rp-mint-2/90 active:bg-rp-mint-2 ${
                  selected ? "ring-2 ring-rp-brand shadow-md" : ""
                }`;
                if (bookableInteraction === "select" && onBookableDateSelect) {
                  return (
                    <button
                      key={isoDate + idx}
                      type="button"
                      title={title}
                      aria-label={`${bookableAria}タップでこの日を選び、午前枠の指定に進みます。`}
                      onClick={() => onBookableDateSelect(isoDate)}
                      className={`${cellClass} w-full text-left`}
                    >
                      <span className="text-xs font-bold tabular-nums text-rp-brand sm:text-base">
                        {dom}
                      </span>
                      <span className="mt-0.5 flex min-h-0 flex-col gap-0.5 text-[9px] leading-snug text-rp-brand sm:gap-1 sm:text-xs">
                        <span className="font-bold tabular-nums">{yearsJa}</span>
                        {rem !== null ? (
                          <span className="font-semibold">残り{rem}枠</span>
                        ) : null}
                      </span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={isoDate + idx}
                    href={`/reserve/${isoDate}`}
                    title={title}
                    aria-label={`${bookableAria}タップで予約入力に進みます。`}
                    className={cellClass}
                  >
                    <span className="text-xs font-bold tabular-nums text-rp-brand sm:text-base">
                      {dom}
                    </span>
                    <span className="mt-0.5 flex min-h-0 flex-col gap-0.5 text-[9px] leading-snug text-rp-brand sm:gap-1 sm:text-xs">
                      <span className="font-bold tabular-nums">{yearsJa}</span>
                      {rem !== null ? (
                        <span className="font-semibold">残り{rem}枠</span>
                      ) : null}
                    </span>
                  </Link>
                );
              }

              const { label: closedLabel, cancelled: isCancelled } =
                closedLabelFromStatus(event!.status);
              const closedAria = `${dayLineJa}。${title}。${closedLabel}のため選択できません。`;

              return (
                <div
                  key={isoDate + idx}
                  title={title}
                  role="group"
                  aria-label={closedAria}
                  className={`${baseCell} cursor-not-allowed ${
                    isCancelled
                      ? "bg-rose-50/90 ring-1 ring-rose-200"
                      : "bg-zinc-100"
                  } ${inCurrentMonth ? "" : "opacity-80"}`}
                >
                  <span
                    className={`text-xs font-bold tabular-nums sm:text-base ${
                      inCurrentMonth ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {dom}
                  </span>
                  <span
                    className={`mt-0.5 line-clamp-3 text-[9px] font-semibold leading-tight sm:text-xs ${
                      isCancelled ? "text-rose-800" : "text-zinc-600"
                    }`}
                  >
                    {closedLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!hasEventInViewMonth ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600">
          この月に公開されている開催日はありません。前後の月へ移動するか、「今月」で表示を切り替えてください。
        </p>
      ) : null}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600 sm:text-sm">
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-rp-brand" />
          受付中（タップで午前枠を選べます）
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-zinc-300" />
          開催はあるが受付不可（締切済・締切後・確定済）
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-red-400" />
          開催中止（雨天／運営／最少催行）
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-white ring-2 ring-zinc-200" />
          開催なし
        </li>
      </ul>
    </div>
  );
}
