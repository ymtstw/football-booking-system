"use client";

/** SCR-01: 開催日を月カレンダーで選択。受付中は強調、締切後・確定済はグレー表示（他月は薄色）。 */
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  IconArrowRight,
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

/** 表示中の月に該当する開催日のみ（スマホはグリッド代わりにリスト表示） */
function eventDaysInMonth(
  days: EventDayPublic[],
  year: number,
  month: number
): EventDayPublic[] {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return days
    .filter((d) => {
      const k = toIsoDateKey(d.event_date);
      return k != null && k.startsWith(ym);
    })
    .sort((a, b) => {
      const ka = toIsoDateKey(a.event_date) ?? "";
      const kb = toIsoDateKey(b.event_date) ?? "";
      return ka.localeCompare(kb);
    });
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

  const monthEvents = useMemo(
    () => eventDaysInMonth(days, viewYear, viewMonth),
    [days, viewYear, viewMonth]
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

      {/* スマホ: 当月の開催日だけをリスト表示（7列グリッドは潰れやすいため非表示） */}
      <div className="space-y-2 sm:hidden">
        {monthEvents.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600">
            この月に公開されている開催日はありません。前後の月へ移動するか、「今月」で表示を切り替えてください。
          </p>
        ) : (
          monthEvents.map((event) => {
            const isoDate = toIsoDateKey(event.event_date);
            if (!isoDate) return null;
            const bookable = event.acceptingReservations;
            const title = `締切: ${formatDateTimeTokyoWithWeekday(
              event.reservation_deadline_at
            )}`;
            const selected = selectedIsoDate === isoDate;
            const { label: closedLabel, cancelled: isCancelled } =
              closedLabelFromStatus(event.status);

            if (bookable) {
              const cardBase =
                "block w-full rounded-xl border-2 border-rp-mint-2 bg-rp-mint/60 px-4 py-3 text-left shadow-sm transition-colors active:bg-rp-mint-2/80";
              const selectedRing = selected
                ? "ring-2 ring-rp-brand ring-offset-2"
                : "";
              if (bookableInteraction === "select" && onBookableDateSelect) {
                return (
                  <button
                    key={event.id}
                    type="button"
                    title={title}
                    onClick={() => onBookableDateSelect(isoDate)}
                    className={`${cardBase} ${selectedRing}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-rp-navy">
                          {formatIsoDateWithWeekdayJa(isoDate)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-700">
                          学年帯 <span className="font-semibold">{event.grade_band}</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{title}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-rp-brand px-2.5 py-1 text-xs font-bold text-white">
                        受付中
                      </span>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rp-brand">
                      この日を選ぶ
                      <IconArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              }
              return (
                <Link
                  key={event.id}
                  href={`/reserve/${isoDate}`}
                  title={title}
                  className={`${cardBase} ${selectedRing}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-rp-navy">
                        {formatIsoDateWithWeekdayJa(isoDate)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        学年帯 <span className="font-semibold">{event.grade_band}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{title}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-rp-brand px-2.5 py-1 text-xs font-bold text-white">
                      受付中
                    </span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rp-brand">
                    予約ページへ
                    <IconArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            }

            return (
              <div
                key={event.id}
                title={title}
                className={`rounded-xl border px-4 py-3 ${
                  isCancelled
                    ? "border-rose-200 bg-rose-50/90"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-zinc-800">
                      {formatIsoDateWithWeekdayJa(isoDate)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      学年帯 <span className="font-medium">{event.grade_band}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isCancelled
                        ? "bg-rose-600 text-white"
                        : "bg-zinc-300 text-zinc-800"
                    }`}
                  >
                    {closedLabel}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-rp-mint-2 bg-white shadow-sm sm:block">
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-px bg-rp-mint-2/80">
            {headers.map((h) => (
              <div
                key={h}
                className="bg-rp-mint/90 py-2 text-center text-xs font-semibold text-rp-navy sm:text-sm"
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
                const selected = selectedIsoDate === isoDate;
                const cellClass = `${baseCell} bg-rp-mint ring-1 ring-rp-brand/25 transition-colors hover:bg-rp-mint-2/90 ${
                  selected ? "ring-2 ring-rp-brand shadow-md" : ""
                }`;
                if (bookableInteraction === "select" && onBookableDateSelect) {
                  return (
                    <button
                      key={isoDate + idx}
                      type="button"
                      title={title}
                      onClick={() => onBookableDateSelect(isoDate)}
                      className={`${cellClass} w-full text-left`}
                    >
                      <span className="text-sm font-semibold tabular-nums text-rp-brand sm:text-base">
                        {dom}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-rp-brand sm:text-xs">
                        {`学年帯 ${event!.grade_band}`}
                      </span>
                      <span className="mt-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-rp-brand sm:text-xs">
                        この日を選ぶ
                        <IconArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={isoDate + idx}
                    href={`/reserve/${isoDate}`}
                    title={title}
                    className={cellClass}
                  >
                    <span className="text-sm font-semibold tabular-nums text-rp-brand sm:text-base">
                      {dom}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-rp-brand sm:text-xs">
                      {`学年帯 ${event!.grade_band}`}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-rp-brand sm:text-xs">
                      予約する
                      <IconArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                );
              }

              const { label: closedLabel, cancelled: isCancelled } =
                closedLabelFromStatus(event!.status);

              return (
                <div
                  key={isoDate + idx}
                  title={title}
                  className={`${baseCell} cursor-not-allowed ${
                    isCancelled
                      ? "bg-rose-50/90 ring-1 ring-rose-200"
                      : "bg-zinc-100"
                  } ${inCurrentMonth ? "" : "opacity-80"}`}
                >
                  <span
                    className={`text-sm font-semibold tabular-nums sm:text-base ${
                      inCurrentMonth ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {dom}
                  </span>
                  <span
                    className={`mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight sm:text-xs ${
                      isCancelled ? "text-rose-900" : "text-zinc-500"
                    }`}
                  >
                    {`学年帯 ${event!.grade_band}`}
                  </span>
                  <span
                    className={`mt-auto text-[10px] font-medium sm:text-xs ${
                      isCancelled ? "text-rose-800" : "text-zinc-500"
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

      <p className="text-xs text-zinc-500 sm:hidden">
        ※スマホは当月の開催日のみ一覧表示です（タブレット以上で月カレンダー表示）。
      </p>

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
