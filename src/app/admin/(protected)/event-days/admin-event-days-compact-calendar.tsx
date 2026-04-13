"use client";

/** 管理: 開催日を月カレンダーで俯瞰。開催セルタップで一覧の基準日（`?around=`）を切り替え。 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { toIsoDateKey } from "@/lib/dates/iso-date-key";
import {
  buildMonthGrid6Rows,
  tokyoYearMonthNow,
  weekdayHeadersJa,
} from "@/lib/dates/tokyo-calendar-grid";

import type { EventDayListRow } from "./event-day-mobile-card";
import { eventDayStatusLabelJa } from "./event-day-status-label";

export type AdminCalendarDay = Pick<
  EventDayListRow,
  "id" | "event_date" | "grade_band" | "status"
>;

function monthTitleJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

function cellClassesForStatus(status: string): string {
  switch (status) {
    case "open":
      return "bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100";
    case "draft":
      return "bg-amber-50/90 ring-1 ring-amber-200/80 hover:bg-amber-100/90";
    case "locked":
      return "bg-zinc-100 ring-1 ring-zinc-300 hover:bg-zinc-200/80";
    default:
      return "bg-sky-50 ring-1 ring-sky-200 hover:bg-sky-100/80";
  }
}

function anchorOutline(isAnchor: boolean): string {
  return isAnchor ? " z-10 outline outline-2 outline-offset-1 outline-emerald-600" : "";
}

export function AdminEventDaysCompactCalendar({
  days,
  initialYearMonth,
  anchorEventDate,
}: {
  days: AdminCalendarDay[];
  initialYearMonth: { year: number; month: number };
  /** 一覧の基準開催日 `YYYY-MM-DD`（セル強調用） */
  anchorEventDate: string;
}) {
  const router = useRouter();

  const byDate = useMemo(() => {
    const m = new Map<string, AdminCalendarDay>();
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
  const baseCell =
    "flex min-h-[3.25rem] flex-col items-stretch border border-transparent p-1 text-left sm:min-h-[3.5rem] sm:p-1.5";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 sm:text-base">
          {monthTitleJa(viewYear, viewMonth)}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={goPrevMonth}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 sm:text-sm"
          >
            ← 前月
          </button>
          <button
            type="button"
            onClick={goThisMonth}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 sm:text-sm"
          >
            今月
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 sm:text-sm"
          >
            次月 →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-[280px] p-1.5 sm:min-w-0 sm:p-2">
          <div className="grid grid-cols-7 gap-px bg-zinc-200">
            {headers.map((h) => (
              <div
                key={h}
                className="bg-zinc-100 py-1.5 text-center text-[10px] font-semibold text-zinc-600 sm:text-xs"
              >
                {h}
              </div>
            ))}
            {grid.map((cell, idx) => {
              const { isoDate, inCurrentMonth } = cell;
              const dom = Number(isoDate.slice(8, 10));
              const ev = byDate.get(isoDate);
              const hasEvent = Boolean(ev);
              const isAnchor = isoDate === anchorEventDate;

              if (!hasEvent) {
                if (isAnchor) {
                  return (
                    <div
                      key={isoDate + idx}
                      title="一覧の基準開催日（この日に開催データはありません）"
                      className={`${baseCell} bg-white${anchorOutline(true)}`}
                    >
                      <span className="text-xs font-semibold tabular-nums text-emerald-900 sm:text-sm">
                        {dom}
                      </span>
                      <span className="mt-auto text-[9px] font-medium text-emerald-800 sm:text-[10px]">
                        基準日
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={isoDate + idx}
                    className={`${baseCell} ${
                      inCurrentMonth ? "bg-white" : "bg-zinc-50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium tabular-nums sm:text-sm ${
                        inCurrentMonth ? "text-zinc-300" : "text-zinc-200"
                      }`}
                    >
                      {dom}
                    </span>
                  </div>
                );
              }

              const sub = ev!.grade_band;
              const title = `${eventDayStatusLabelJa(ev!.status)} · 学年帯 ${sub}（一覧の基準日にする）`;

              return (
                <button
                  key={isoDate + idx}
                  type="button"
                  title={title}
                  onClick={() => {
                    router.push(`/admin/event-days?around=${isoDate}`);
                  }}
                  className={`${baseCell} cursor-pointer rounded-none transition-colors ${cellClassesForStatus(
                    ev!.status
                  )}${anchorOutline(isAnchor)}`}
                >
                  <span className="text-xs font-semibold tabular-nums text-zinc-900 sm:text-sm">
                    {dom}
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-[9px] font-medium leading-tight text-zinc-800 sm:text-[10px]">
                    {sub}
                  </span>
                  <span className="mt-auto text-[9px] font-medium text-zinc-600 sm:text-[10px]">
                    {eventDayStatusLabelJa(ev!.status)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-zinc-600 sm:text-xs">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded border border-amber-200 bg-amber-50" />
          公開前
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded border border-emerald-200 bg-emerald-50" />
          公開済み
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded border border-zinc-300 bg-zinc-100" />
          締切済み等
        </li>
        <li className="text-zinc-500">
          緑枠＝一覧の基準開催日。開催セルをタップで基準を切り替え。
        </li>
      </ul>
    </div>
  );
}
