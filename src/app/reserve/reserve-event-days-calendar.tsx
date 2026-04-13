"use client";

/** SCR-01: 開催日を月カレンダーで選択。受付中は強調、締切済・他月はグレー。 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
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
};

function monthTitleJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function ReserveEventDaysCalendar({
  days,
  initialYearMonth,
}: {
  days: EventDayPublic[];
  /** 一覧取得後に最も早い開催日のある月へ合わせる */
  initialYearMonth: { year: number; month: number };
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, EventDayPublic>();
    for (const d of days) {
      m.set(d.event_date, d);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
          {monthTitleJa(viewYear, viewMonth)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            ← 前の月
          </button>
          <button
            type="button"
            onClick={goThisMonth}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            今月
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            次の月 →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="min-w-[320px] p-2 sm:min-w-0 sm:p-3">
          <div className="grid grid-cols-7 gap-px bg-zinc-200">
            {headers.map((h) => (
              <div
                key={h}
                className="bg-zinc-100 py-2 text-center text-xs font-semibold text-zinc-700 sm:text-sm"
              >
                {h}
              </div>
            ))}
            {grid.map((cell, idx) => {
              const { isoDate, inCurrentMonth } = cell;
              const dom = Number(isoDate.slice(8, 10));
              const event = byDate.get(isoDate);
              const hasEvent = Boolean(event);
              const bookable = hasEvent && event!.acceptingReservations;

              const baseCell =
                "flex min-h-[4.5rem] flex-col border border-transparent p-1.5 sm:min-h-[5.5rem] sm:p-2";

              if (!hasEvent) {
                return (
                  <div
                    key={isoDate + idx}
                    className={`${baseCell} ${
                      inCurrentMonth ? "bg-white" : "bg-zinc-50"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium tabular-nums sm:text-base ${
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

              if (bookable) {
                return (
                  <Link
                    key={isoDate + idx}
                    href={`/reserve/${isoDate}`}
                    title={title}
                    className={`${baseCell} bg-emerald-50/90 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100`}
                  >
                    <span className="text-sm font-semibold tabular-nums text-emerald-950 sm:text-base">
                      {dom}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-emerald-900 sm:text-xs">
                      学年帯 {event!.grade_band}
                    </span>
                    <span className="mt-auto text-[10px] font-semibold text-emerald-800 sm:text-xs">
                      予約する →
                    </span>
                  </Link>
                );
              }

              return (
                <div
                  key={isoDate + idx}
                  title={title}
                  className={`${baseCell} cursor-not-allowed bg-zinc-100 ${
                    inCurrentMonth ? "" : "opacity-80"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold tabular-nums sm:text-base ${
                      inCurrentMonth ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {dom}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-zinc-500 sm:text-xs">
                    学年帯 {event!.grade_band}
                  </span>
                  <span className="mt-auto text-[10px] font-medium text-zinc-500 sm:text-xs">
                    受付終了
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600 sm:text-sm">
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded border border-emerald-300 bg-emerald-50" />
          受付中（タップで午前枠を選べます）
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded border border-zinc-200 bg-zinc-100" />
          開催はあるが締切済み
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded bg-white ring-1 ring-zinc-200" />
          開催なし
        </li>
      </ul>
    </div>
  );
}
