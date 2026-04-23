"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ReserveEventDaysCalendar,
  type EventDayPublic,
} from "../reserve-event-days-calendar";
import { IconArrowRight, IconCalendar } from "../_components/reserve-icons";
import { ReserveMainShell } from "../_components/ui";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
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

/** 対戦表ハブ上部のカード一覧は直近のみ（カレンダーは全件） */
const SCHEDULE_HUB_LIST_MAX = 2;

function gradeYearsDisplay(gradeBand: string): string {
  const s = gradeBand.trim();
  if (!s) return "—";
  if (s.endsWith("年")) return s;
  return `${s}年`;
}

function statusBadgeJa(status: string): { text: string; tone: "ok" | "muted" | "bad" } {
  if (status === "cancelled_weather")
    return { text: "雨天中止", tone: "bad" };
  if (status === "cancelled_operational")
    return { text: "運営中止", tone: "bad" };
  if (status === "cancelled_minimum")
    return { text: "最少未達中止", tone: "bad" };
  if (status === "confirmed") return { text: "確定済", tone: "ok" };
  if (status === "locked") return { text: "締切後", tone: "muted" };
  return { text: "受付中", tone: "ok" };
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
    <div className="space-y-8">
      <ReserveMainShell>
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-900">
            <IconCalendar className="h-3.5 w-3.5" strokeWidth={2} />
            誰でも閲覧可（確認コード不要）
          </p>
          <h1 className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
            対戦表・スケジュール
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            本日以降の開催日を選ぶと、午前枠の状況と、編成が確定した開催日では対戦表を表示します。予約の変更・取消は「予約の確認・キャンセル」から行ってください。
          </p>
        </div>
      </ReserveMainShell>

      {upcomingDays.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          現在、本日以降で公開されている開催日はありません。
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-800 sm:text-lg">
              開催日一覧（直近）
            </h2>
            {upcomingDays.length > SCHEDULE_HUB_LIST_MAX ? (
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                直近 {SCHEDULE_HUB_LIST_MAX} 件を表示しています。そのほかの開催日は下のカレンダーから選べます。
              </p>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingListDays.map((d) => {
                const badge = statusBadgeJa(d.status);
                const toneClass =
                  badge.tone === "bad"
                    ? "border-rose-200 bg-rose-50/80 hover:bg-rose-50"
                    : badge.tone === "ok" && d.acceptingReservations
                      ? "border-green-200 bg-green-50/80 hover:bg-green-50"
                      : "border-sky-200 bg-sky-50/80 hover:bg-sky-50";
                return (
                  <li key={d.id}>
                    <Link
                      href={`/reserve/schedule/${d.event_date}`}
                      className={`flex min-h-18 flex-col justify-between rounded-xl border p-4 shadow-sm transition-colors ${toneClass}`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatIsoDateWithWeekdayJa(d.event_date)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {gradeYearsDisplay(d.grade_band)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            badge.tone === "bad"
                              ? "bg-rose-200 text-rose-900"
                              : badge.tone === "ok" && d.acceptingReservations
                                ? "bg-green-200 text-green-900"
                                : "bg-sky-200 text-sky-900"
                          }`}
                        >
                          {badge.text}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rp-brand">
                          表示
                          <IconArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <ReserveEventDaysCalendar
            days={upcomingDays}
            initialYearMonth={initialYm}
            navigationMode="schedule"
          />
        </>
      )}
    </div>
  );
}
