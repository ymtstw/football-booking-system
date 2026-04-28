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
import { publicScheduleHubStatusLabel } from "@/lib/event-days/public-schedule-hub-status";
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
  /** 対戦案内メール送信済み（公開側で「試合スケジュール確定」扱い） */
  matchingProposalNoticeSentAt?: string | null;
  /** GET /api/event-days で付与。有効予約（チーム）数 */
  activeReservationCount?: number;
  /** GET /api/event-days で付与。受付中のみ数値、それ以外は null */
  morningRemainingVacancies?: number | null;
};

function monthTitleJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** カレンダー日セル下部の短い状態表示 */
function calendarCellSubLabel(
  navigationMode: "booking" | "schedule",
  event: {
  status: string;
  acceptingReservations: boolean;
  matchingProposalNoticeSentAt?: string | null;
}): { label: string; cancelled: boolean } {
  // 予約する画面では「試合スケジュール確認中/確定」を見せず、受付可否に寄せる
  if (navigationMode === "booking") {
    const { cancelled } = publicScheduleHubStatusLabel(event);
    if (cancelled) return { label: "中止", cancelled: true };
    if (event.acceptingReservations) return { label: "予約受付中", cancelled: false };
    return { label: "受付終了", cancelled: false };
  }
  const { label, cancelled } = publicScheduleHubStatusLabel(event);
  return { label, cancelled };
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
  /** `schedule` のとき開催日セルはすべて対戦表ページへ（予約入力には進まない） */
  navigationMode = "booking",
}: {
  days: EventDayPublic[];
  /** 一覧取得後に最も早い開催日のある月へ合わせる */
  initialYearMonth: { year: number; month: number };
  /** `select` のとき受付中セルは Link ではなくボタン（開催日選択ページ） */
  bookableInteraction?: "link" | "select";
  onBookableDateSelect?: (isoDate: string) => void;
  /** 選択中の日付を強調 */
  selectedIsoDate?: string | null;
  navigationMode?: "booking" | "schedule";
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

  const scheduleHubCalendar = navigationMode === "schedule";
  const monthNavBtnClass = scheduleHubCalendar
    ? "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-10 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm"
    : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rp-mint-2 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-rp-mint/50";

  return (
    <div className={scheduleHubCalendar ? "space-y-3" : "space-y-4"}>
      <div
        className={
          scheduleHubCalendar
            ? "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
            : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        {scheduleHubCalendar ? (
          <h2 className="text-base font-semibold tracking-tight text-slate-700 sm:text-lg">
            {monthTitleJa(viewYear, viewMonth)}
          </h2>
        ) : (
          <ReserveHeadingWithIcon
            as="h2"
            shell="navy"
            icon={<IconCalendar className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.65} />}
            className="min-w-0"
            textClassName="min-w-0 text-lg font-bold text-rp-navy sm:text-xl"
          >
            {monthTitleJa(viewYear, viewMonth)}
          </ReserveHeadingWithIcon>
        )}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={goPrevMonth} className={monthNavBtnClass}>
            <IconChevronLeft className="h-3.5 w-3.5 text-rp-brand sm:h-4 sm:w-4" />
            前の月
          </button>
          <button type="button" onClick={goThisMonth} className={monthNavBtnClass}>
            今月
          </button>
          <button type="button" onClick={goNextMonth} className={monthNavBtnClass}>
            次の月
            <IconChevronRight className="h-3.5 w-3.5 text-rp-brand sm:h-4 sm:w-4" />
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

              if (navigationMode === "schedule") {
                const { label: stLabel, cancelled: isCancelled } =
                  calendarCellSubLabel("schedule", event!);
                const dayLineJa = formatIsoDateWithWeekdayJa(isoDate);
                const yearsJa = gradeYearsDisplay(event!.grade_band);
                const title = `締切: ${formatDateTimeTokyoWithWeekday(
                  event!.reservation_deadline_at
                )}`;
                const aria = `${dayLineJa}。${yearsJa}（学年帯）。${title}。${stLabel}。タップで参加チーム・試合予定・開催可否を表示します。`;
                const cellClass =
                  `${baseCell} w-full text-left ring-1 transition-colors ` +
                  (isCancelled
                    ? "bg-rose-50/90 ring-rose-200 hover:bg-rose-100/90"
                    : event!.acceptingReservations
                      ? "bg-rp-mint ring-rp-brand/20 hover:bg-rp-mint-2/90"
                      : "bg-sky-50 ring-sky-200 hover:bg-sky-100/80");
                return (
                  <Link
                    key={isoDate + idx}
                    href={`/reserve/schedule/${isoDate}`}
                    title={title}
                    aria-label={aria}
                    className={cellClass}
                  >
                    <span
                      className={`text-xs font-bold tabular-nums sm:text-base ${
                        isCancelled ? "text-rose-800" : "text-rp-navy"
                      }`}
                    >
                      {dom}
                    </span>
                    <span className="mt-0.5 line-clamp-3 text-[9px] font-semibold leading-tight text-rp-navy sm:text-xs">
                      {yearsJa}
                    </span>
                    <span
                      className={`mt-0.5 line-clamp-2 text-[8px] font-medium leading-tight sm:text-[10px] ${
                        isCancelled ? "text-rose-800" : "text-slate-600"
                      }`}
                    >
                      {stLabel}
                    </span>
                  </Link>
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
                      aria-label={`${bookableAria}タップで開催日を選択します。`}
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
                calendarCellSubLabel("booking", event!);
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
          <span className="h-4 w-4 shrink-0 rounded-full bg-rp-brand" aria-hidden />
          <span>緑：受付中</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-zinc-300" aria-hidden />
          <span>灰：受付不可</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-red-400" aria-hidden />
          <span>赤：中止</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full bg-white ring-2 ring-zinc-200" aria-hidden />
          <span>白：開催なし</span>
        </li>
      </ul>
    </div>
  );
}
