import Link from "next/link";
import { Suspense } from "react";

import { NotificationHistoryHubClient } from "@/components/admin/notification-history-hub-client";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminNotificationsFailedPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventDayId?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw =
    typeof sp.eventDayId === "string" ? sp.eventDayId.trim() : "";
  const eventDayId = raw && UUID_RE.test(raw) ? raw : undefined;

  let eventDateLabel: string | null = null;
  if (eventDayId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_days")
      .select("event_date")
      .eq("id", eventDayId)
      .maybeSingle();
    if (data?.event_date) {
      eventDateLabel = formatIsoDateWithWeekdayJa(data.event_date);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl">
      <p className="mb-2 text-xs text-zinc-500">
        <Link href="/admin/dashboard" className="text-emerald-800 underline underline-offset-2">
          直近の開催状況
        </Link>
        {" · "}
        <Link href="/admin/event-days" className="text-emerald-800 underline underline-offset-2">
          開催日一覧
        </Link>
        {eventDayId ? (
          <>
            {" · "}
            <Link
              href={`/admin/event-days/${eventDayId}`}
              className="text-emerald-800 underline underline-offset-2"
            >
              この開催のまとめ
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">メール送信履歴</h1>
      {eventDayId && eventDateLabel ? (
        <p className="mb-2 text-sm text-zinc-700">
          表示中: <span className="font-medium text-zinc-900">{eventDateLabel}</span> のみ（タブで状態を切り替え）
          <Link
            href="/admin/notifications/failed"
            className="ml-2 font-medium text-sky-800 underline underline-offset-2"
          >
            全開催日へ
          </Link>
        </p>
      ) : null}
      <div className="mb-6 max-w-3xl space-y-3 text-sm leading-relaxed text-zinc-700">
        <p>この画面では、メールの送信処理の記録を確認できます。</p>
        <p>受信者に届いたかどうかを確認する画面ではありません。</p>
        <p>
          「送信処理済み」は、システム上でメール送信の手続きが完了した状態です。
          <br />
          届かなかった場合でも、送信エラーに表示されないことがあります。
        </p>
        <p>
          問い合わせ時は、送信処理済みの記録と宛先メールアドレスを確認してください。
          <br />
          必要に応じて再送、または電話・別メールなどでご案内ください。
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-zinc-600">読み込み中…</p>}
      >
        <NotificationHistoryHubClient eventDayId={eventDayId} />
      </Suspense>
    </div>
  );
}
