import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MailNotificationHistoryClient } from "@/components/admin/mail-notification-history-client";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminMailNotificationHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    eventDayId?: string | string[];
    dateBasis?: string | string[];
    date?: string | string[];
    status?: string | string[];
    limit?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw =
    typeof sp.eventDayId === "string" ? sp.eventDayId.trim() : "";
  const eventDayId = raw && UUID_RE.test(raw) ? raw : undefined;

  let initialFilterDate: string | null = null;
  let eventDateLabel: string | null = null;
  if (eventDayId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_days")
      .select("event_date")
      .eq("id", eventDayId)
      .maybeSingle();
    const ed = data?.event_date;
    if (typeof ed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ed)) {
      initialFilterDate = ed;
      eventDateLabel = formatIsoDateWithWeekdayJa(ed);
    }
  }

  const existingDate =
    typeof sp.date === "string" ? sp.date.trim() : "";
  if (
    eventDayId &&
    initialFilterDate &&
    existingDate !== initialFilterDate
  ) {
    const q = new URLSearchParams();
    q.set("eventDayId", eventDayId);
    q.set("dateBasis", "eventDate");
    q.set("date", initialFilterDate);
    q.set("status", "all");
    q.set("limit", "20");
    q.set("offset", "0");
    redirect(`/admin/notifications/failed?${q.toString()}`);
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl">
      <p className="mb-2 text-xs text-zinc-500">
        <Link
          href="/admin/dashboard"
          className="text-emerald-800 underline underline-offset-2"
        >
          直近の開催日
        </Link>
        {" · "}
        <Link
          href="/admin/event-days"
          className="text-emerald-800 underline underline-offset-2"
        >
          開催日一覧
        </Link>
        {eventDayId ? (
          <>
            {" · "}
            <Link
              href={`/admin/event-days/${eventDayId}`}
              className="text-emerald-800 underline underline-offset-2"
            >
              この日の運営画面
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">
        メール送信履歴
      </h1>
      {eventDayId && eventDateLabel ? (
        <p className="mb-2 text-sm text-zinc-700">
          開催日{" "}
          <span className="font-medium text-zinc-900">{eventDateLabel}</span>{" "}
          で絞り込むためのショートカットです（日付は下のフォームに入ります）。
          <Link
            href="/admin/notifications/failed"
            className="ml-2 font-medium text-sky-800 underline underline-offset-2"
          >
            ショートカットなしへ
          </Link>
        </p>
      ) : null}
      <div className="mb-6 max-w-3xl space-y-2 text-sm leading-relaxed text-zinc-700">
        <p>
          システムがメール送信処理を行った履歴です。相手の受信箱への到達を保証するものではありません。
        </p>
        <p className="text-xs text-zinc-600">
          「送信処理済み」でも未達の場合があります。問い合わせ時は記録と宛先を確認し、必要なら再送や別手段でご案内ください。
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-600">読み込み中…</p>}>
        <MailNotificationHistoryClient initialFilterDate={initialFilterDate} />
      </Suspense>
    </div>
  );
}
