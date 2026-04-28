import { EventDayOpsBreadcrumb } from "../../event-day-ops-breadcrumb";
import { NotificationSummaryClient } from "./notification-summary-client";

export default async function AdminEventDayNotificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <EventDayOpsBreadcrumb eventDayId={id} items={[{ label: "通知・送信状況" }]} />
      <h1 className="mb-4 text-lg font-semibold text-zinc-900">通知・送信状況</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        締切・マッチング案内（2日前16:00頃）・前日最終（16:30頃）・雨天即時の送信状況をまとめて表示します。
        <br />
        送信状況により、到着まで数分程度かかる場合があります。
      </p>
      <NotificationSummaryClient eventDayId={id} />
    </div>
  );
}
