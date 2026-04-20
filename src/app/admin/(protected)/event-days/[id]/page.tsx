/** 開催日の運営まとめ: サマリ・警告・各詳細への導線（仕様: docs/spec/implemented-behavior-catalog.md §7） */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LunchMealBreakdown } from "@/components/admin/lunch-meal-breakdown";
import { DeadlineCatchupEmergencyClient } from "./deadline-catchup-emergency-client";
import { eventDayStatusLabelJa } from "../event-day-status-label";
import { loadEventDayHubPayload } from "@/lib/admin/event-day-hub-payload";
import { preDayConfirmedJa, weatherSummaryJa } from "@/lib/admin/dashboard-event-day-labels";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminEventDayHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminUser())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  if (!id) {
    notFound();
  }

  const supabase = await createClient();
  const loaded = await loadEventDayHubPayload(supabase, id);

  if (!loaded.ok && loaded.kind === "db_error") {
    return (
      <div className="min-w-0 space-y-4">
        <h1 className="text-xl font-bold text-zinc-900">開催日</h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          開催日の取得に失敗しました: {loaded.message}
        </p>
      </div>
    );
  }

  if (!loaded.ok) {
    notFound();
  }

  const { day, summary } = loaded.data;

  const nowIso = new Date().toISOString();
  const showDeadlineCatchupEmergency =
    day.status === "open" &&
    Boolean(day.reservation_deadline_at?.trim()) &&
    day.reservation_deadline_at <= nowIso;

  const preDayBase = `/admin/pre-day-results?date=${encodeURIComponent(day.event_date)}`;
  const preDayAdjustHref = `${preDayBase}&tab=adjust`;
  const reservationsHref = `/admin/reservations?eventDayId=${encodeURIComponent(day.id)}`;
  const notificationsHref = `/admin/event-days/${day.id}/notifications`;

  const preDayProminent =
    day.status === "locked" ||
    day.status === "confirmed" ||
    day.status === "cancelled_weather" ||
    day.status === "cancelled_operational" ||
    day.status === "cancelled_minimum";

  const warnings: { key: string; label: string; href?: string; tone: "amber" | "red" }[] = [];
  if (summary.warningCount != null && summary.warningCount > 0) {
    warnings.push({
      key: "warn",
      label: `編成 warning が ${summary.warningCount} 件あります`,
      href: preDayAdjustHref,
      tone: "amber",
    });
  }

  /** サマリ表のラベル（濃度を揃え、値との差は字重・位置で出す） */
  const sumLabel = "text-sm font-medium text-zinc-600";
  const sumHint = "mt-0.5 block text-xs font-normal leading-snug text-zinc-500";
  const sumValue = "text-sm font-medium text-zinc-900";
  const sumValueNum = "text-sm font-semibold tabular-nums text-zinc-900";

  return (
    <div className="min-w-0 space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-md ring-1 ring-zinc-100 sm:p-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-700"
          aria-hidden
        />
        <div className="relative space-y-3 pl-4 sm:pl-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">開催運営 · この開催のまとめ</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {formatIsoDateWithWeekdayJa(day.event_date)}
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                学年帯 <span className="font-semibold text-zinc-800">{day.grade_band}</span>
                <span className="mx-2 text-zinc-300">·</span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    day.status === "open"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : day.status === "draft"
                        ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                        : "border-zinc-200 bg-white text-zinc-800"
                  }`}
                >
                  {eventDayStatusLabelJa(day.status)}
                </span>
              </p>
            </div>
            <Link
              href="/admin/event-days"
              className="inline-flex min-h-10 w-fit items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              開催日一覧へ
            </Link>
          </div>
          <p className="max-w-3xl border-t border-zinc-100 pt-3 text-sm leading-relaxed text-zinc-600">
            予約・昼食・通知の状況などを<strong className="font-medium text-zinc-800">このページでひと通り把握</strong>
            し、公開・締切・雨天・試合の手直しなどの<strong className="font-medium text-zinc-800">操作は下のリンク先</strong>
            で行います。
          </p>
        </div>
      </header>

      {/* 上段: サマリ・警告 */}
      <section aria-labelledby="hub-summary" className="space-y-4">
        <h2 id="hub-summary" className="sr-only">
          サマリ
        </h2>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <dl className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start">
              <dt>
                <span className={`block ${sumLabel}`}>予約締切</span>
                <span className={sumHint}>UTC で保存・東京で表示</span>
              </dt>
              <dd className={`min-w-0 sm:text-right ${sumValue}`}>
                {formatDateTimeTokyoWithWeekday(day.reservation_deadline_at)}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
              <dt>
                <span className={`block ${sumLabel}`}>予約チーム数</span>
                <span className={sumHint}>有効な申し込み（active）</span>
              </dt>
              <dd className={`min-w-0 sm:text-right ${sumValueNum}`}>{summary.activeTeamCount}</dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-2 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start">
              <dt>
                <span className={`block ${sumLabel}`}>昼食</span>
                <span className={sumHint}>有効予約の食数・予約時メニュー名</span>
              </dt>
              <dd className="min-w-0">
                <LunchMealBreakdown
                  totalMeals={summary.totalMeals}
                  lunchByMenu={summary.lunchByMenu}
                  variant="inline"
                />
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
              <dt>
                <span className={`block ${sumLabel}`}>合計参加人数</span>
              </dt>
              <dd className={`min-w-0 sm:text-right ${sumValueNum}`}>{summary.totalParticipants}</dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
              <dt>
                <span className={`block ${sumLabel}`}>雨天・開催可否</span>
              </dt>
              <dd className={`min-w-0 sm:text-right ${sumValue}`}>
                {weatherSummaryJa(summary.status, summary.weather_status)}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 border-b border-zinc-100 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start">
              <dt>
                <span className={`block ${sumLabel}`}>試合編成（確定）</span>
              </dt>
              <dd className="min-w-0 sm:text-right">
                <span className={sumValueNum}>{preDayConfirmedJa(summary.status)}</span>
                <span className={`mt-1 block sm:text-right ${sumHint}`}>
                  対戦の変更は下の「試合の手直し」から
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
              <dt>
                <span className={`block ${sumLabel}`}>通知送信失敗</span>
                <span className={sumHint}>この開催に紐づく配信</span>
              </dt>
              <dd className="min-w-0 sm:text-right">
                {summary.failedForDay > 0 ? (
                  <Link
                    href={notificationsHref}
                    className={`inline-block ${sumValueNum} text-red-800 underline decoration-red-600/50 underline-offset-2 hover:text-red-950`}
                  >
                    {summary.failedForDay} 件
                  </Link>
                ) : (
                  <span className={sumValueNum}>0</span>
                )}
              </dd>
            </div>
          </dl>

          <aside className="flex min-h-0 flex-col gap-3 lg:h-full">
            {warnings.length === 0 ? (
              <div className="flex min-h-32 flex-1 flex-col justify-center rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm leading-relaxed text-emerald-950 lg:min-h-0">
                <p>
                  編成の警告はありません。メールの<strong className="font-semibold">送信失敗</strong>は左の「
                  <strong className="font-semibold">通知送信失敗</strong>」を確認してください。
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {warnings.map((w) => (
                  <li
                    key={w.key}
                    className={
                      w.tone === "red"
                        ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
                        : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
                    }
                  >
                    {w.href ? (
                      <Link href={w.href} className="underline decoration-current/50 underline-offset-2">
                        {w.label}
                      </Link>
                    ) : (
                      w.label
                    )}
                  </li>
                ))}
              </ul>
            )}
            {day.notes?.trim() ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm shadow-sm">
                <p className={`${sumLabel}`}>運営メモ</p>
                <p className="mt-2 whitespace-pre-wrap wrap-break-word text-zinc-800">{day.notes.trim()}</p>
                <p className={`mt-2 ${sumHint}`}>編集は開催日一覧の行操作から。</p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {/* 次のアクション（主導線3本は同じ高さ・次画面で確定する前提） */}
      <section aria-labelledby="hub-actions" className="space-y-3">
        <h2 id="hub-actions" className="text-base font-semibold text-zinc-900">
          次のアクション
        </h2>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <Link
            href={reservationsHref}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg bg-gradient-to-r from-sky-700 to-sky-800 px-3 text-center text-sm font-semibold text-white shadow-md ring-1 ring-sky-900/20 hover:from-sky-800 hover:to-sky-900"
          >
            この日の予約一覧
          </Link>
          <Link
            href={preDayAdjustHref}
            className={
              preDayProminent
                ? "inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 text-center text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100/90"
                : "inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border-2 border-emerald-400/80 bg-emerald-50/90 px-3 py-1.5 text-center text-sm font-semibold text-emerald-950 hover:border-emerald-500 hover:bg-emerald-100/90"
            }
          >
            <span>試合の手直し</span>
            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-emerald-900/85">
              前日確定・自動編成の調整
            </span>
          </Link>
          <Link
            href={`/admin/event-days/${day.id}/weather`}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border-2 border-sky-400 bg-sky-50 px-3 py-1.5 text-center text-sm font-semibold text-sky-950 shadow-sm hover:border-sky-500 hover:bg-sky-100/90"
          >
            <span>雨天判断</span>
            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-sky-900/85">
              次の画面で登録・確定
            </span>
          </Link>
        </div>
        <p className="mx-auto max-w-4xl text-xs leading-relaxed text-zinc-600">
          「試合の手直し」は<strong className="font-medium text-zinc-800">対戦の割当</strong>です。「
          <strong className="font-medium text-zinc-800">枠・時刻</strong>」は公開枠の時刻・有効化です（下の確認・設定から）。
        </p>
      </section>

      {/* 下段: 確認・設定（参照） / 例外 */}
      <section aria-labelledby="hub-deep" className="space-y-4">
        <h2 id="hub-deep" className="text-base font-semibold text-zinc-900">
          確認・設定
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
          <Link
            href={`/admin/event-days/${day.id}/slots`}
            className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition hover:border-emerald-200/80 hover:ring-emerald-100/60"
          >
            <p className="text-sm font-bold text-zinc-900">公開枠・時刻</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              公開枠の時刻・有効化・強制変更（対戦の付け替えではありません）
            </p>
          </Link>
          <div
            className={
              summary.failedForDay > 0
                ? "flex min-h-[5.5rem] flex-col justify-between rounded-lg border-2 border-red-200/90 bg-red-50/50 px-4 py-3 sm:min-h-0"
                : "flex min-h-[5.5rem] flex-col justify-between rounded-lg border border-zinc-200/90 bg-zinc-50/60 px-4 py-3 sm:min-h-0"
            }
          >
            <p
              className={
                summary.failedForDay > 0
                  ? "text-sm font-medium text-red-950"
                  : "text-sm font-medium text-zinc-800"
              }
            >
              {summary.failedForDay > 0
                ? "送信失敗の確認・再送（件数は左表）"
                : "送信の履歴・再送"}
            </p>
            <Link
              href={notificationsHref}
              className={
                summary.failedForDay > 0
                  ? "mt-2 inline-flex w-fit items-center text-sm font-semibold text-red-900 underline decoration-red-700/40 underline-offset-2 hover:text-red-950"
                  : "mt-2 inline-flex w-fit items-center text-sm font-semibold text-violet-800 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-950"
              }
            >
              送信結果を開く →
            </Link>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
          <div className="min-w-0 flex flex-col">
            <h3 className="mb-2 text-sm font-semibold text-rose-900/90">例外（運営中止）</h3>
            <div className="min-h-0 flex-1 rounded-xl border border-rose-200/90 bg-rose-50/50 p-4 shadow-sm ring-1 ring-rose-100/80">
              <Link
                href={`/admin/event-days/${day.id}/operational-cancel`}
                className="text-sm font-bold text-rose-950 underline decoration-rose-600/50 underline-offset-2 hover:text-rose-900"
              >
                緊急・運営中止
              </Link>
              <p className="mt-1.5 text-xs leading-relaxed text-rose-900/90">
                頻用ではない操作です。雨天による中止は「雨天判断」から登録してください。
              </p>
            </div>
          </div>
          <div className="min-w-0 flex flex-col">
            <h3 className="mb-2 text-sm font-semibold text-amber-950/90">例外（締切）</h3>
            {showDeadlineCatchupEmergency ? (
              <DeadlineCatchupEmergencyClient eventDayId={day.id} />
            ) : (
              <details className="min-h-0 flex-1 rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 text-left shadow-sm ring-1 ring-zinc-100/80">
                <summary className="cursor-pointer text-xs font-medium text-zinc-800 hover:text-zinc-950">
                  締切を過ぎても「公開中」のままのとき
                </summary>
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-600">
                  <p>
                    毎日、システムが自動で締め切り処理をします。それが動いていないときだけ、この欄に「締め切り処理を実行」が出ます（今は該当しないため説明のみです）。
                  </p>
                  <p>
                    手順の詳細は社内の運用手順（前日〜締切まわり）を参照してください。開催日一覧から手動で締め切りだけするボタンはありません。
                  </p>
                </div>
              </details>
            )}
          </div>
        </div>
        <p className="border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
          合宿・大会の問い合わせは{" "}
          <Link href="/admin/camp-inquiries" className="font-medium text-zinc-700 underline underline-offset-2">
            合宿相談
          </Link>
          {" · "}
          <Link
            href="/admin/tournament-inquiries"
            className="font-medium text-zinc-700 underline underline-offset-2"
          >
            大会お問い合わせ
          </Link>
          （対応案件）。昼食の数は上のサマリで確認し、メニュー編集は{" "}
          <Link href="/admin/lunch-menu" className="font-medium text-zinc-700 underline underline-offset-2">
            設定の昼食メニュー
          </Link>
          から行ってください。
        </p>
      </section>
    </div>
  );
}
