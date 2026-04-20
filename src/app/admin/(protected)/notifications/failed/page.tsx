import Link from "next/link";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";
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
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">メール送信失敗一覧</h1>
      {eventDayId && eventDateLabel ? (
        <p className="mb-2 text-sm text-zinc-700">
          表示中: <span className="font-medium text-zinc-900">{eventDateLabel}</span> の失敗のみ
          <Link
            href="/admin/notifications/failed"
            className="ml-2 font-medium text-sky-800 underline underline-offset-2"
          >
            全件表示へ
          </Link>
        </p>
      ) : null}
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-600">
        送信に失敗したメールの直近分を表示します。原因を直したうえで「再送」を試してください。「予約直後の確認メール」だけは安全のため再送できません。
      </p>
      <NotificationFailedRetryTable eventDayId={eventDayId} />
    </div>
  );
}
