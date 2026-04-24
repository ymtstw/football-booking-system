"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ReserveEventDaysCalendar,
  type EventDayPublic,
} from "../reserve-event-days-calendar";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { publicScheduleHubStatusLabel } from "@/lib/event-days/public-schedule-hub-status";
import {
  initialYearMonthFromEvents,
  tokyoIsoDateToday,
} from "@/lib/dates/tokyo-calendar-grid";
import { toIsoDateKey } from "@/lib/dates/iso-date-key";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";

/** 開催確認ハブ上部のカード一覧は直近のみ（カレンダーは全件） */
const SCHEDULE_HUB_LIST_MAX = 2;

function gradeYearsDisplay(gradeBand: string): string {
  const s = gradeBand.trim();
  if (!s) return "—";
  if (s.endsWith("年")) return s;
  return `${s}年`;
}

export function ScheduleHubClient() {
  const [days, setDays] = useState<EventDayPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/event-days");
        const json = (await res.json().catch(() => ({}))) as {
          eventDays?: EventDayPublic[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(
            reserveFlowApiErrorDisplay(res.status, json.error, "一覧の取得に失敗しました")
          );
          setDays([]);
          return;
        }
        setError(null);
        setDays(json.eventDays ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(
          reserveFlowUserVisibleMessage(
            e instanceof Error ? e.message : String(e),
            RESERVE_FLOW_NETWORK_ERROR_JA
          )
        );
        setDays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = tokyoIsoDateToday();

  const upcomingDays = useMemo(() => {
    if (!days) return [];
    return [...days]
      .filter((d) => {
        const k = toIsoDateKey(d.event_date);
        return k != null && k >= today;
      })
      .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
  }, [days, today]);

  const initialYm = useMemo(
    () => initialYearMonthFromEvents(upcomingDays.map((d) => d.event_date)),
    [upcomingDays]
  );

  const upcomingListDays = useMemo(
    () => upcomingDays.slice(0, SCHEDULE_HUB_LIST_MAX),
    [upcomingDays]
  );

  if (!days) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        読み込み中…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
          開催日ごとの参加チーム・試合予定
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          開催日ごとに、参加チーム・試合予定・開催可否を確認できます。
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          開催日を選ぶと、その日の参加チームや試合スケジュールの詳細を確認できます。
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          前日17:30頃までに最終の開催可否を反映します。予約の変更・取消は
          <Link
            href="/reserve/manage"
            className="font-semibold text-rp-brand underline underline-offset-2 hover:text-rp-navy"
          >
            「予約の確認・キャンセル」
          </Link>
          から行えます。
        </p>
      </header>

      {upcomingDays.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
          現在、本日以降で公開されている開催日はありません。
        </p>
      ) : (
        <>
          <section className="space-y-2" aria-labelledby="schedule-recent-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="schedule-recent-heading" className="text-lg font-bold text-slate-900">
                開催日一覧（直近）
              </h2>
              {upcomingDays.length > SCHEDULE_HUB_LIST_MAX ? (
                <p className="text-xs text-slate-500">ほかは下のカレンダーから</p>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              直近の開催日を一覧で確認できます。
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              参加チーム数や現在の状況を確認し、詳しく見たい日程を選択してください。
            </p>
            <ul className="flex flex-col gap-2">
              {upcomingListDays.map((d) => {
                const st = publicScheduleHubStatusLabel(d);
                const teamCount =
                  typeof d.activeReservationCount === "number" ? d.activeReservationCount : 0;
                const toneClass =
                  st.tone === "bad"
                    ? "border-rose-200 bg-rose-50/90 hover:bg-rose-50"
                    : st.tone === "ok"
                      ? "border-green-200 bg-green-50/90 hover:bg-green-50"
                      : "border-sky-200 bg-sky-50/90 hover:bg-sky-50";
                const badgeClass =
                  st.tone === "bad"
                    ? "bg-rose-200 text-rose-900"
                    : st.tone === "ok"
                      ? "bg-green-200 text-green-900"
                      : "bg-sky-200 text-sky-900";
                return (
                  <li key={d.id}>
                    <Link
                      href={`/reserve/schedule/${d.event_date}`}
                      className={`flex min-h-[3.25rem] items-center gap-3 rounded-lg border px-3 py-2 shadow-sm transition-colors active:scale-[0.99] sm:min-h-14 sm:px-3.5 sm:py-2.5 ${toneClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-tight text-slate-900 sm:text-[15px]">
                          {formatIsoDateWithWeekdayJa(d.event_date)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-600">
                            {gradeYearsDisplay(d.grade_band)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                          >
                            {st.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-600">
                          参加チーム：{teamCount}チーム
                        </p>
                      </div>
                      <span className="inline-flex min-h-10 max-w-[10.5rem] shrink-0 items-center justify-center rounded-lg bg-rp-brand px-2 py-1.5 text-center text-[11px] font-bold leading-snug text-white shadow-sm ring-1 ring-rp-brand/30 sm:min-h-11 sm:max-w-none sm:whitespace-nowrap sm:px-3.5 sm:text-sm">
                        参加チーム・試合予定を見る
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="border-t border-slate-200/90 pt-5 sm:pt-6"
            aria-labelledby="schedule-calendar-heading"
          >
            <h2
              id="schedule-calendar-heading"
              className="text-sm font-semibold text-slate-600 sm:text-base"
            >
              カレンダーから開催日を探す
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              カレンダーから開催日を選ぶと、その日の参加チーム・試合予定・開催可否を確認できます。
            </p>
            <div className="mt-2 sm:mt-3">
              <ReserveEventDaysCalendar
                days={upcomingDays}
                initialYearMonth={initialYm}
                navigationMode="schedule"
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
              ※試合予定や開催可否は、開催日の詳細画面で確認できます。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
