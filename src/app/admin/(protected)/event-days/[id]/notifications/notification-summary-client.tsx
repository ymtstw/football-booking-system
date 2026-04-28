"use client";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
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
    /** 枠強制 PATCH 後の朝枠変更メール（API が未更新の環境では欠ける） */
    morningSlotForceChanged?: { sent: number; pendingOrFailed: number };
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
      setError(json.error ?? "通知の状況を読み込めませんでした。再読み込みするか、しばらくしてから試してください。");
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
          天候対応
        </Link>
        {" · "}
        <Link
          href={`/admin/event-days/${eventDayId}/slots`}
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          枠・時刻設定
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
            <dt className="text-zinc-500">対象学年</dt>
            <dd>{data.gradeBand}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">有効な予約数</dt>
            <dd className="font-semibold">{data.activeReservationCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">公開状況</dt>
            <dd>{eventDayStatusLabelJa(data.status)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">天候の登録</dt>
            <dd>{data.weatherStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">予約締切</dt>
            <dd className="wrap-break-word text-xs">
              {formatDateTimeTokyoWithWeekday(data.reservationDeadlineAt)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">前日一括で雨天中止文面を送る予約（16:30頃）</dt>
            <dd>{data.weatherDayBeforeRainScheduled ? "あり" : "なし"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">対戦案内メール（16:00頃・目安17:00まで）</dt>
            <dd>{data.matchingProposalNoticeSentAt ? "送信処理済み" : "未"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">前日最終メール（16:30頃・目安17:30まで）</dt>
            <dd>{data.finalDayBeforeNoticeCompletedAt ? "完了記録あり" : "未完了"}</dd>
          </div>
          <div className="sm:col-span-2 border-t border-zinc-100 pt-3">
            <dt className="mb-2 font-medium text-zinc-800">メール送信の件数</dt>
            <dd className="space-y-1 text-xs text-zinc-700">
              <p>
                最少催行中止: 送信処理済み {data.notifications.minimumCancelNotice.sent} 件 / 未送信・送信エラー{" "}
                {data.notifications.minimumCancelNotice.pendingOrFailed} 件
              </p>
              <p>
                対戦案内: 送信処理済み {data.notifications.matchingProposal.sent} 件 / 未送信・送信エラー{" "}
                {data.notifications.matchingProposal.pendingOrFailed} 件
              </p>
              <p>
                雨天即時: 送信処理済み {data.notifications.weatherCancelImmediate.sent} 件 / 未送信・送信エラー{" "}
                {data.notifications.weatherCancelImmediate.pendingOrFailed} 件
              </p>
              <p>
                前日最終: 送信処理済み {data.notifications.dayBeforeFinal.sent} 件 / 未送信・送信エラー{" "}
                {data.notifications.dayBeforeFinal.pendingOrFailed} 件
              </p>
              <p>
                朝枠・時刻の変更案内（枠の強制変更後）: 送信処理済み{" "}
                {data.notifications.morningSlotForceChanged?.sent ?? 0} 件 / 未送信・送信エラー{" "}
                {data.notifications.morningSlotForceChanged?.pendingOrFailed ?? 0} 件
              </p>
            </dd>
          </div>
        </dl>
      ) : !error ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : null}

      {data ? (
        <section className="rounded-lg border border-red-200/80 bg-red-50/30 px-4 py-4">
          <h2 className="text-sm font-semibold text-red-950">送信エラーの確認</h2>
          <p className="mt-1 text-xs leading-relaxed text-red-900/85">
            送信を試みたときに「送れない」と返ってきたものだけが並びます。お客様の端末に届いたかどうかは分かりません。届いていないのにここが空なこともあります。宛先と内容を確認し、「予約完了メール」以外の行では「このメールを再送する」が使えます。
          </p>
          <div className="mt-3">
            <NotificationFailedRetryTable eventDayId={eventDayId} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
