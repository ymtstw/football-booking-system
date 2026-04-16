"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { DashboardEventDaySummaryPayload } from "@/lib/admin/dashboard-event-day-summary.types";
import { preDayConfirmedJa, weatherSummaryJa } from "@/lib/admin/dashboard-event-day-labels";
import { eventDayStatusLabelJa } from "../event-days/event-day-status-label";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";

type ApiOk = { day: DashboardEventDaySummaryPayload | null };
type ApiErr = { error: string };

function EventDayCard(props: {
  summary: DashboardEventDaySummaryPayload;
  variant: "nearest" | "following";
  todayTokyo: string;
  tomorrowTokyo: string;
}) {
  const { summary, variant, todayTokyo, tomorrowTokyo } = props;
  const preDayBase = `/admin/pre-day-results?date=${encodeURIComponent(summary.event_date)}`;
  const preDayFailedHref = `${preDayBase}&notifications=failed#notifications-failed`;

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-5">
        <p className="text-xs font-medium text-zinc-500">
          {variant === "nearest" ? "直近の開催（1件）" : "次の開催日"}
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          <span className="text-lg font-semibold text-zinc-900">
            {formatIsoDateWithWeekdayJa(summary.event_date)}
          </span>
          <span className="text-sm text-zinc-600">学年帯 {summary.grade_band}</span>
          <span className="inline-flex w-fit rounded-md bg-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-800">
            {eventDayStatusLabelJa(summary.status)}
          </span>
        </div>
        {variant === "nearest" ? (
          <>
            {summary.event_date === todayTokyo ? (
              <p className="mt-2 text-xs text-zinc-500">本日の開催日として表示しています。</p>
            ) : summary.event_date > tomorrowTokyo ? (
              <p className="mt-2 text-xs text-zinc-500">
                明日より先の、登録済みでいちばん近い開催日です。
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">直前のカードより後の、登録済みでいちばん近い日です。</p>
        )}
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">active 予約チーム数</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{summary.activeTeamCount}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">合計昼食（食数）</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{summary.totalMeals}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">合計参加人数</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{summary.totalParticipants}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">雨天状態</dt>
            <dd className="text-right text-zinc-800">
              {weatherSummaryJa(summary.status, summary.weather_status)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">前日確定（編成確定）</dt>
            <dd className="font-medium text-zinc-900">{preDayConfirmedJa(summary.status)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-zinc-100 pb-2">
            <dt className="text-zinc-500">編成 warning</dt>
            <dd className="font-medium text-zinc-900">
              {summary.warningCount != null && summary.warningCount > 0 ? (
                <span className="text-amber-800">あり（{summary.warningCount}）</span>
              ) : (
                <span className="text-zinc-600">なし</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">通知 failed</dt>
            <dd>
              {summary.failedForDay > 0 ? (
                <Link
                  href={preDayFailedHref}
                  className="font-semibold tabular-nums text-red-800 underline decoration-red-600/50 underline-offset-2 hover:text-red-950"
                >
                  {summary.failedForDay} 件
                </Link>
              ) : (
                <span className="font-semibold tabular-nums text-zinc-700">0</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col justify-end gap-2 sm:items-start">
          <Link
            href={preDayBase}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-medium text-white hover:bg-emerald-900 sm:w-auto"
          >
            前日確定へ
          </Link>
          <Link
            href="/admin/event-days"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:w-auto"
          >
            開催日管理へ
          </Link>
          <Link
            href={`/admin/event-days/${summary.id}/weather`}
            className="inline-flex min-h-10 w-full items-center justify-center text-sm font-medium text-sky-800 underline decoration-sky-600/50 underline-offset-2 hover:text-sky-950 sm:w-auto"
          >
            雨天判断へ
          </Link>
        </div>
      </div>
    </article>
  );
}

export function DashboardUpcomingChain(props: {
  todayTokyo: string;
  tomorrowTokyo: string;
  initialDay: DashboardEventDaySummaryPayload;
}) {
  const { todayTokyo, tomorrowTokyo, initialDay } = props;
  const [chain, setChain] = useState<DashboardEventDaySummaryPayload[]>([initialDay]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    const last = chain[chain.length - 1];
    if (!last || loading || exhausted) return;

    setLoading(true);
    setLoadMessage(null);
    try {
      const res = await fetch(
        `/api/admin/dashboard/next-event-day?after=${encodeURIComponent(last.event_date)}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as ApiOk & Partial<ApiErr>;
      if (!res.ok) {
        setLoadMessage(json.error ?? `読み込みに失敗しました (${res.status})`);
        return;
      }
      if (!json.day) {
        setExhausted(true);
        return;
      }
      setChain((prev) => [...prev, json.day as DashboardEventDaySummaryPayload]);
    } catch {
      setLoadMessage("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [chain, loading, exhausted]);

  return (
    <section aria-labelledby="dash-upcoming" className="space-y-4">
      <h2 id="dash-upcoming" className="sr-only">
        直近の開催
      </h2>

      {chain.map((summary, i) => (
        <EventDayCard
          key={summary.id}
          summary={summary}
          variant={i === 0 ? "nearest" : "following"}
          todayTokyo={todayTokyo}
          tomorrowTokyo={tomorrowTokyo}
        />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void loadNext()}
          disabled={loading || exhausted}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? "読み込み中…" : "次の開催日を読み込む"}
        </button>
        {exhausted ? (
          <p className="text-xs text-zinc-500">これより後の登録開催日はありません。</p>
        ) : null}
      </div>

      {loadMessage ? (
        <p className="text-sm text-amber-900" role="status">
          {loadMessage}
        </p>
      ) : null}
    </section>
  );
}
