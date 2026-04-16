import Link from "next/link";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";

export default function AdminNotificationsFailedPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-xs text-zinc-500">
        <Link href="/admin/dashboard" className="text-emerald-800 underline underline-offset-2">
          ダッシュボード
        </Link>
        {" · "}
        <Link href="/admin/event-days" className="text-emerald-800 underline underline-offset-2">
          開催日
        </Link>
      </p>
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">メール送信失敗一覧</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-600">
        <code className="rounded bg-zinc-100 px-1">notifications.status = failed</code>{" "}
        の直近分を表示します。Resend のエラー解消・宛先修正後に「再送」できます。予約完了メールのみ、確認コードの都合で再送できません。
      </p>
      <NotificationFailedRetryTable />
    </div>
  );
}
