/** 開催日1件のモバイル用カード（md 未満）。テーブル横スクロールの代替。 */
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";

import { eventDayStatusLabelJa } from "./event-day-status-label";
import {
  EventDayRowActions,
  type EventDayAdminStatus,
} from "./event-day-row-actions";

export type EventDayListRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
};

export function EventDayMobileCard({ row }: { row: EventDayListRow }) {
  return (
    <article
      className={`rounded-lg border border-zinc-200 p-4 ${
        row.status === "open"
          ? "bg-emerald-50/80"
          : row.status === "draft"
            ? "bg-white"
            : "bg-zinc-50/80"
      }`}
    >
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-2 text-sm">
        <dt className="text-zinc-500">開催日</dt>
        <dd className="min-w-0 font-medium text-zinc-900">
          {formatIsoDateWithWeekdayJa(row.event_date)}
        </dd>
        <dt className="text-zinc-500">学年帯</dt>
        <dd className="text-zinc-800">{row.grade_band}</dd>
        <dt className="text-zinc-500">状態</dt>
        <dd>
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
              row.status === "open"
                ? "bg-emerald-200 text-emerald-900"
                : row.status === "draft"
                  ? "bg-zinc-200 text-zinc-800"
                  : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {eventDayStatusLabelJa(row.status)}
          </span>
        </dd>
        <dt className="text-zinc-500">締切</dt>
        <dd className="min-w-0 text-xs leading-snug text-zinc-600">
          {formatDateTimeTokyoWithWeekday(row.reservation_deadline_at)}
        </dd>
      </dl>
      <div className="mt-4 border-t border-zinc-200 pt-3">
        <EventDayRowActions
          id={row.id}
          status={row.status as EventDayAdminStatus}
          eventDate={row.event_date}
          layout="stacked"
        />
      </div>
    </article>
  );
}
