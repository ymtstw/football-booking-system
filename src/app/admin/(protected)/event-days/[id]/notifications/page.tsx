import Link from "next/link";

import { NotificationSummaryClient } from "./notification-summary-client";

export default async function AdminEventDayNotificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="mb-2 text-xs text-zinc-500">
        <Link href="/admin/event-days" className="text-emerald-800 underline underline-offset-2">
          開催日一覧
        </Link>
      </p>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900">通知・送信状況</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        締切・マッチング案内（2日前16:30想定）・前日17:00最終・雨天即時の送信状況をまとめて表示します。
      </p>
      <NotificationSummaryClient eventDayId={id} />
    </div>
  );
}
