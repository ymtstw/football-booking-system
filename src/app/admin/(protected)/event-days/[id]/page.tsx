/** 開催日の運営まとめ: サマリ・警告・各詳細への導線（仕様: docs/spec/implemented-behavior-catalog.md §7） */
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LunchMealBreakdown } from "@/components/admin/lunch-meal-breakdown";
import { DeadlineCatchupEmergencyClient } from "./deadline-catchup-emergency-client";
import { EventDayHubNotesClient } from "./event-day-hub-notes-client";
import { eventDayStatusLabelJa } from "../event-day-status-label";
import { loadEventDayHubPayload } from "@/lib/admin/event-day-hub-payload";
import { preDayConfirmedJa, weatherSummaryJa } from "@/lib/admin/dashboard-event-day-labels";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 6.5L12.5 10.5L8 14.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 読み取り専用の指標カード（クリック不可の見た目） */
function HubInfoCard({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 shadow-sm ${className ?? ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{hint}</p> : null}
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

/** 確認・設定: 遷移する設定カード */
function SettingNavCard({
  href,
  title,
  description,
  stateLabel,
  stateTone,
}: {
  href: string;
  title: string;
  description: string;
  stateLabel: string;
  stateTone?: "neutral" | "warn" | "danger";
}) {
  const badge =
    stateTone === "danger"
      ? "border-red-200 bg-red-50 text-red-900"
      : stateTone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-zinc-200 bg-zinc-100 text-zinc-700";
  return (
    <Link
      href={href}
      className="group flex min-h-21 items-stretch gap-3 rounded-xl border border-emerald-200/90 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge}`}
          >
            {stateLabel}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">{description}</p>
      </div>
      <span className="flex shrink-0 items-center text-emerald-700/70 transition group-hover:text-emerald-800">
        <ChevronRightIcon className="size-5" />
      </span>
    </Link>
  );
}

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
          開催日の情報を表示できませんでした。時間をおいて再度お試しください。
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

  const warnings: { key: string; label: string; href?: string }[] = [];
  if (summary.warningCount != null && summary.warningCount > 0) {
    warnings.push({
      key: "warn",
      label: `対戦編成の注意が ${summary.warningCount} 件あります`,
      href: preDayAdjustHref,
    });
  }

  const matchLabel = preDayConfirmedJa(summary.status);
  const matchNeedsAttention =
    summary.status !== "confirmed" && !String(matchLabel).startsWith("済");

  const weatherLine = weatherSummaryJa(summary.status, summary.weather_status);
  const weatherIsCancelled =
    day.status === "cancelled_weather" ||
    day.status === "cancelled_operational" ||
    day.status === "cancelled_minimum";

  return (
    <div className="min-w-0 space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-md ring-1 ring-zinc-100 sm:p-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-emerald-600 to-emerald-800"
          aria-hidden
        />
        <div className="relative space-y-3 pl-4 sm:pl-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">開催運営 · この日の運営画面</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {formatIsoDateWithWeekdayJa(day.event_date)}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <span>
                  対象学年 <span className="font-semibold text-zinc-800">{day.grade_band}</span>
                </span>
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
              className="inline-flex min-h-10 w-fit shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              開催日一覧へ
            </Link>
          </div>
          <p className="max-w-3xl border-t border-zinc-100 pt-3 text-sm leading-relaxed text-zinc-600">
            指標は参照のみです。設定や詳細は下のカード・ボタンから開きます。
          </p>
        </div>
      </header>

      {/* サマリ（情報カードのみ） + 右: 要確認・運営メモ */}
      <section aria-labelledby="hub-summary" className="space-y-4">
        <h2 id="hub-summary" className="sr-only">
          サマリ
        </h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,18.5rem)] lg:items-start">
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">この日の指標</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <HubInfoCard title="予約締切" hint="日本時間">
                <p className="text-sm font-semibold tabular-nums text-zinc-900">
                  {formatDateTimeTokyoWithWeekday(day.reservation_deadline_at)}
                </p>
              </HubInfoCard>
              <HubInfoCard title="予約チーム数" hint="有効な予約">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{summary.activeTeamCount}</p>
              </HubInfoCard>
              <HubInfoCard title="合計参加人数">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{summary.totalParticipants}</p>
              </HubInfoCard>
              <HubInfoCard title="雨天・開催可否">
                <p
                  className={`text-sm font-semibold leading-snug ${
                    weatherIsCancelled ? "text-red-800" : "text-zinc-900"
                  }`}
                >
                  {weatherLine}
                </p>
              </HubInfoCard>
              <HubInfoCard title="試合表（確定）" hint="対戦の変更は試合表画面から">
                <p
                  className={`text-sm font-semibold ${
                    matchNeedsAttention ? "text-amber-950" : "text-zinc-900"
                  }`}
                >
                  {matchLabel}
                </p>
              </HubInfoCard>
              <HubInfoCard title="送信エラー" hint="処理時点の記録（到達可否ではない）">
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    summary.failedForDay > 0 ? "text-amber-950" : "text-zinc-900"
                  }`}
                >
                  {summary.failedForDay} 件
                </p>
              </HubInfoCard>
            </div>
            <HubInfoCard title="昼食" hint="有効予約の食数・予約時メニュー名" className="sm:col-span-2 xl:col-span-3">
              <LunchMealBreakdown
                totalMeals={summary.totalMeals}
                lunchByMenu={summary.lunchByMenu}
                variant="panel"
              />
            </HubInfoCard>
          </div>

          <aside
            className="flex min-h-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100 lg:sticky lg:top-4"
            aria-labelledby="hub-attention-heading"
          >
            <div>
              <h3 id="hub-attention-heading" className="text-sm font-semibold text-zinc-900">
                要確認
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                試合編成の警告・メール送信エラー・締切リカバリの必要があるときだけ、ここに一覧します。
              </p>
            </div>

            {warnings.length === 0 &&
            summary.failedForDay === 0 &&
            !showDeadlineCatchupEmergency ? (
              <p className="text-xs leading-relaxed text-zinc-600">いまは該当がありません。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {warnings.map((w) => (
                  <li
                    key={w.key}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950"
                  >
                    {w.href ? (
                      <Link href={w.href} className="font-medium underline decoration-amber-700/40 underline-offset-2">
                        {w.label}
                      </Link>
                    ) : (
                      <span className="font-medium">{w.label}</span>
                    )}
                  </li>
                ))}
                {summary.failedForDay > 0 ? (
                  <li className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="font-medium text-amber-950">
                      メール送信エラー {summary.failedForDay} 件
                    </span>
                    <Link
                      href={notificationsHref}
                      className="mt-1 block text-xs font-medium text-amber-950 underline decoration-amber-800/40 underline-offset-2"
                    >
                      送信履歴で確認する →
                    </Link>
                  </li>
                ) : null}
                {showDeadlineCatchupEmergency ? (
                  <li className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                    <strong className="font-semibold">締切:</strong> 締切後も「公開中」のままです。下の「締切の取り直し」を確認してください。
                  </li>
                ) : null}
              </ul>
            )}

            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-semibold text-zinc-900">運営メモ</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                この開催日だけの共有メモです。下の入力欄に書いて「メモを保存」すると登録されます（連絡の抜け漏れ対策）。
              </p>
              <EventDayHubNotesClient eventDayId={day.id} initialNotes={day.notes ?? null} />
            </div>
          </aside>
        </div>
      </section>

      {/* 次のアクション: primary 1 / secondary / tertiary */}
      <section aria-labelledby="hub-actions" className="space-y-3">
        <h2 id="hub-actions" className="text-sm font-semibold text-zinc-900">
          次のアクション
        </h2>
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={preDayAdjustHref}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg bg-emerald-600 px-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <span>試合表を確認・編集</span>
            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-emerald-50/95">
              割当の調整
            </span>
          </Link>
          <Link
            href={reservationsHref}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border-2 border-emerald-600 bg-white px-3 text-center text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            予約を確認する
          </Link>
          <Link
            href={`/admin/event-days/${day.id}/weather`}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border-2 border-emerald-600 bg-white px-3 py-1.5 text-center text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <span>天候対応を登録する</span>
            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-emerald-900/85">
              次の画面で確定
            </span>
          </Link>
          <Link
            href={notificationsHref}
            className="inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            <span>メール送信履歴</span>
            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-zinc-600">
              処理ログ・再送
            </span>
          </Link>
        </div>
        <p className="mx-auto max-w-5xl text-xs leading-relaxed text-zinc-600">
          試合の<strong className="font-medium text-zinc-800">割当</strong>は「試合表を確認・編集」。枠の<strong className="font-medium text-zinc-800">時刻・有効／無効</strong>は「枠・時刻設定」です。
        </p>
      </section>

      {/* 確認・設定（押せるカードに統一） */}
      <section aria-labelledby="hub-deep" className="space-y-4">
        <h2 id="hub-deep" className="text-sm font-semibold text-zinc-900">
          確認・設定
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingNavCard
            href={`/admin/event-days/${day.id}/slots`}
            title="枠・時刻設定"
            description="試合枠の時刻・有効化・強制変更（対戦の付け替えではありません）"
            stateLabel="設定へ"
          />
          <SettingNavCard
            href={`/admin/event-days/${day.id}/lunch`}
            title="昼食（この開催日）"
            description="共通メニューのままか、この日だけ並べるメニューを限定するか"
            stateLabel="設定へ"
          />
          <SettingNavCard
            href={notificationsHref}
            title="メール送信履歴・再送"
            description="送信処理の記録と失敗時の再送（指標の件数と連動）"
            stateLabel={
              summary.failedForDay > 0 ? `エラー ${summary.failedForDay} 件` : "問題なし"
            }
            stateTone={summary.failedForDay > 0 ? "warn" : "neutral"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
          <div className="min-w-0 flex flex-col">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
              危険・中止
            </h3>
            <div className="min-h-0 flex-1 rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-sm">
              <Link
                href={`/admin/event-days/${day.id}/operational-cancel`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-red-900 underline decoration-red-600/40 underline-offset-2 hover:text-red-950"
              >
                緊急・運営中止
                <ChevronRightIcon className="size-4 shrink-0" />
              </Link>
              <p className="mt-2 text-xs leading-relaxed text-red-900/90">
                頻用ではない操作です。天候による中止は「天候対応を登録する」から登録してください。
              </p>
            </div>
          </div>
          <div className="min-w-0 flex flex-col">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
              締切・注意
            </h3>
            {showDeadlineCatchupEmergency ? (
              <DeadlineCatchupEmergencyClient eventDayId={day.id} />
            ) : (
              <details className="min-h-0 flex-1 rounded-xl border border-amber-200/90 bg-amber-50/50 p-3 text-left shadow-sm">
                <summary className="cursor-pointer text-xs font-medium text-amber-950 hover:text-amber-950">
                  締切を過ぎても「公開中」のままのとき
                </summary>
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-amber-950/90">
                  <p>
                    毎日、システムが自動で締め切り処理をします。それが動いていないときだけ、締切リカバリを使います（今は該当しないため説明のみです）。
                  </p>
                  <p>
                    開催日一覧から手動で締め切りだけするボタンはありません。運用手順は社内ドキュメントを参照してください。
                  </p>
                </div>
              </details>
            )}
          </div>
        </div>
        <p className="border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
          合宿・大会の問い合わせは届いた通知メール起点の運用です。昼食マスタの編集は{" "}
          <Link href="/admin/lunch-menu" className="font-medium text-emerald-800 underline underline-offset-2">
            昼食メニュー設定
          </Link>
          から行ってください。
        </p>
      </section>
    </div>
  );
}
