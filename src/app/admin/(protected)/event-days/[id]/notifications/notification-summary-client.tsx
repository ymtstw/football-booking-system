"use client";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SummaryJson = {
  eventDayId: string;
  eventDate: string;
  gradeBand: string;
  status: string;
  weatherStatus: string | null;
  reservationDeadlineAt: string;
  activeReservationCount: number;
  weatherDayBeforeRainScheduled: boolean;
  matchingProposalNoticeSentAt: string | null;
  finalDayBeforeNoticeCompletedAt: string | null;
  notifications: {
    minimumCancelNotice: { sent: number; pendingOrFailed: number };
    matchingProposal: { sent: number; pendingOrFailed: number };
    weatherCancelImmediate: { sent: number; pendingOrFailed: number };
    dayBeforeFinal: { sent: number; pendingOrFailed: number };
  };
};

export function NotificationSummaryClient({ eventDayId }: { eventDayId: string }) {
  const [data, setData] = useState<SummaryJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/event-days/${eventDayId}/notification-summary`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as SummaryJson & { error?: string };
    if (!res.ok) {
      setError(json.error ?? `エラー（${res.status}）`);
      setData(null);
      return;
    }
    setData(json as SummaryJson);
  }, [eventDayId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        <Link
          href={`/admin/event-days/${eventDayId}/weather`}
          className="font-medium text-sky-800 underline decoration-sky-600/60 underline-offset-2"
        >
          雨天判断
        </Link>
        {" · "}
        <Link
          href={`/admin/event-days/${eventDayId}/slots`}
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          枠・時刻
        </Link>
        {" · "}
        <Link
          href="/admin/notifications/failed"
          className="font-medium text-indigo-800 underline decoration-indigo-600/60 underline-offset-2"
        >
          全開催の送信失敗
        </Link>
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
      >
        再読み込み
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data ? (
        <dl className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">開催日</dt>
            <dd className="font-medium text-zinc-900">{data.eventDate}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">学年帯</dt>
            <dd>{data.gradeBand}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">予約数（active）</dt>
            <dd className="font-semibold">{data.activeReservationCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">開催日 status</dt>
            <dd>{data.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">天候フラグ</dt>
            <dd>{data.weatherStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">予約締切（DB）</dt>
            <dd className="break-words text-xs">{data.reservationDeadlineAt}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">前日17:00 雨天中止予約</dt>
            <dd>{data.weatherDayBeforeRainScheduled ? "オン" : "オフ"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">マッチング案内送信（16:30 Cron）</dt>
            <dd>{data.matchingProposalNoticeSentAt ? "送信済" : "未"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">最終通知（前日17:00 Cron・完了フラグ）</dt>
            <dd>{data.finalDayBeforeNoticeCompletedAt ? "完了記録あり" : "未完了"}</dd>
          </div>
          <div className="sm:col-span-2 border-t border-zinc-100 pt-3">
            <dt className="mb-2 font-medium text-zinc-800">notifications 集計（sent / 未送信系）</dt>
            <dd className="space-y-1 text-xs text-zinc-700">
              <p>
                最少催行中止: {data.notifications.minimumCancelNotice.sent} 送信 /{" "}
                {data.notifications.minimumCancelNotice.pendingOrFailed} pending・failed
              </p>
              <p>
                マッチング案内: {data.notifications.matchingProposal.sent} /{" "}
                {data.notifications.matchingProposal.pendingOrFailed}
              </p>
              <p>
                雨天即時: {data.notifications.weatherCancelImmediate.sent} /{" "}
                {data.notifications.weatherCancelImmediate.pendingOrFailed}
              </p>
              <p>
                前日最終: {data.notifications.dayBeforeFinal.sent} /{" "}
                {data.notifications.dayBeforeFinal.pendingOrFailed}
              </p>
            </dd>
          </div>
        </dl>
      ) : !error ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : null}

      {data ? (
        <section className="rounded-lg border border-red-200/80 bg-red-50/30 px-4 py-4">
          <h2 className="text-sm font-semibold text-red-950">この開催日の送信失敗（failed）</h2>
          <p className="mt-1 text-xs text-red-900/85">
            宛先・テンプレ・エラー内容を確認し、問題が解消したら「再送」を押してください。
          </p>
          <div className="mt-3">
            <NotificationFailedRetryTable eventDayId={eventDayId} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
