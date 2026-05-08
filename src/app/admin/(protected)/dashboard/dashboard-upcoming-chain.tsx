"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { LunchMealBreakdown } from "@/components/admin/lunch-meal-breakdown";
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
  const hubHref = `/admin/event-days/${summary.id}`;
  const preDayBase = `/admin/pre-day-results?date=${encodeURIComponent(summary.event_date)}`;
  /** 失敗件数は詳細確認をまとめ側（通知状況）に寄せる */
  const notificationsHref = `/admin/event-days/${summary.id}/notifications`;
  /** 締切後〜は試合編成（前日確定）への導線をやや強調 */
  const preDayProminent =
    summary.status === "locked" ||
    summary.status === "confirmed" ||
    summary.status === "cancelled_weather" ||
    summary.status === "cancelled_operational" ||
    summary.status === "cancelled_minimum";

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md ring-1 ring-zinc-100/80">
      <div className="relative border-b border-zinc-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-zinc-50/90 px-4 py-4 sm:px-5">
        <div
          className="absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700"
          aria-hidden
        />
        <div className="pl-4">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">
            {variant === "nearest" ? "直近の開催（1件）" : "次の開催日"}
          </p>
          <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
            <Link
              href={hubHref}
              className="text-xl font-bold tracking-tight text-zinc-900 underline decoration-emerald-700/40 decoration-2 underline-offset-2 hover:text-emerald-950 sm:text-2xl"
            >
              {formatIsoDateWithWeekdayJa(summary.event_date)}
            </Link>
            <span className="text-sm font-medium text-zinc-600">学年帯 {summary.grade_band}</span>
            <span className="inline-flex w-fit rounded-full border border-zinc-200/80 bg-white px-2.5 py-0.5 text-xs font-semibold text-zinc-800 shadow-sm">
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
      </div>

      {/* ワイドPC: ブロック全体を max-width で抑え、指標は列内でさらに読みやすい幅に */}
      <div className="mx-auto grid w-full max-w-[52rem] grid-cols-1 items-start gap-5 px-4 py-5 sm:grid-cols-2 sm:gap-x-6 sm:px-6 sm:py-6 lg:gap-x-8">
        <dl className="min-w-0 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50/40 text-sm shadow-inner lg:max-w-md xl:max-w-lg">
          <div className="grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5">
            <dt className="text-zinc-500">予約中のチーム数</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 sm:text-right">{summary.activeTeamCount}</dd>
          </div>
          <div className="grid grid-cols-1 items-start gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:px-3.5">
            <dt className="pt-0.5 text-sm font-medium text-zinc-700">
              <span className="block">昼食</span>
              <span className="mt-1 block text-[11px] font-normal leading-snug text-zinc-500">
                有効予約・予約時メニュー名
              </span>
            </dt>
            <dd className="min-w-0 w-full">
              <LunchMealBreakdown
                totalMeals={summary.totalMeals}
                lunchByMenu={summary.lunchByMenu}
                variant="inline"
              />
            </dd>
          </div>
          <div className="grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5">
            <dt className="text-zinc-500">合計参加人数</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 sm:text-right">{summary.totalParticipants}</dd>
          </div>
          <div className="grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5">
            <dt className="text-zinc-500">雨天状態</dt>
            <dd className="font-medium text-zinc-800 sm:text-right">
              {weatherSummaryJa(summary.status, summary.weather_status)}
            </dd>
          </div>
          <div className="grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5">
            <dt className="text-zinc-500">試合表（確定）</dt>
            <dd className="font-semibold text-zinc-900 sm:text-right">{preDayConfirmedJa(summary.status)}</dd>
          </div>
          <div className="grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5">
            <dt className="text-zinc-500">編成の注意</dt>
            <dd className="font-semibold text-zinc-900 sm:text-right">
              {summary.warningCount != null && summary.warningCount > 0 ? (
                <span className="inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-900">
                  あり（{summary.warningCount}）
                </span>
              ) : (
                <span className="text-zinc-600">なし</span>
              )}
            </dd>
          </div>
          <div
            className={`grid grid-cols-1 items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3.5 ${
              summary.failedForDay > 0
                ? "rounded-b-xl bg-red-50/95 ring-1 ring-inset ring-red-200/90 sm:bg-red-50/90"
                : ""
            }`}
          >
            <dt
              className={
                summary.failedForDay > 0
                  ? "font-medium text-red-950/90"
                  : "text-zinc-500"
              }
            >
              未対応の送信エラー
            </dt>
            <dd className="sm:text-right">
              {summary.failedForDay > 0 ? (
                <Link
                  href={notificationsHref}
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

        <div className="flex min-h-0 min-w-0 w-full flex-col justify-start gap-3 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/80 to-white p-4 shadow-sm sm:items-stretch">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={hubHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-900/15 hover:from-emerald-700 hover:to-emerald-800"
            >
              この日の運営画面へ
            </Link>
            <Link
              href={preDayBase}
              className={
                preDayProminent
                  ? "inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100/90"
                  : "inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-emerald-500/70 bg-white px-4 text-sm font-semibold text-emerald-900 shadow-sm hover:border-emerald-600 hover:bg-emerald-50/90"
              }
            >
              試合表を確認・編集
            </Link>
          </div>
          <p className="text-xs leading-snug text-zinc-500">
            「この日の運営画面へ」から予約・試合表・天候・メールなどへの導線があります。
          </p>
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
        setLoadMessage(json.error ?? "一覧を読み込めませんでした。通信とログイン状態を確認してください。");
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

      <div className="mx-auto flex w-full max-w-[52rem] flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <button
          type="button"
          onClick={() => void loadNext()}
          disabled={loading || exhausted}
          className="inline-flex min-h-11 w-full max-w-md items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[17rem]"
        >
          {loading ? "読み込み中…" : "次の開催日を読み込む"}
        </button>
        {exhausted ? (
          <p className="text-center text-xs text-zinc-500 sm:text-left">これより後の登録開催日はありません。</p>
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
