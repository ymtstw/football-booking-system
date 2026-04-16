/** 開催日管理: 一覧（サーバー取得）・追加フォーム・行ごとの公開前／公開。 */
import Link from "next/link";

import {
  ADMIN_EVENT_DAY_CALENDAR_MAX,
  ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR,
  ADMIN_EVENT_DAY_LIST_FROM_ANCHOR,
} from "@/lib/admin/event-day-list-limits";
import { parseAroundParam } from "@/lib/admin/parse-around-param";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { tokyoIsoDateToday, tokyoYearMonthNow } from "@/lib/dates/tokyo-calendar-grid";
import { createClient } from "@/lib/supabase/server";

import { AdminEventDaysCompactCalendar } from "./admin-event-days-compact-calendar";
import { CreateEventDayForm } from "./create-event-day-form";
import { EventDayMobileCard } from "./event-day-mobile-card";
import { eventDayStatusLabelJa } from "./event-day-status-label";
import {
  EventDayRowActions,
  type EventDayAdminStatus,
} from "./event-day-row-actions";

const LIST_SELECT =
  "id, event_date, grade_band, status, reservation_deadline_at, created_at" as const;

type ListRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
  created_at: string;
};

function yearMonthFromIsoDate(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return tokyoYearMonthNow();
  return { year: y, month: m };
}

export default async function AdminEventDaysPage({
  searchParams,
}: {
  searchParams?: Promise<{ around?: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const todayTokyo = tokyoIsoDateToday();
  const aroundFromUrl = parseAroundParam(sp.around);
  const explicitAnchor = aroundFromUrl !== null;
  const anchorEventDate = aroundFromUrl ?? todayTokyo;

  const supabase = await createClient();

  const calendarPromise = supabase
    .from("event_days")
    .select("id, event_date, grade_band, status")
    .order("event_date", { ascending: true })
    .limit(ADMIN_EVENT_DAY_CALENDAR_MAX);

  const beforePromise = supabase
    .from("event_days")
    .select(LIST_SELECT)
    .lt("event_date", anchorEventDate)
    .order("event_date", { ascending: false })
    .limit(ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR);

  const fromPromise = supabase
    .from("event_days")
    .select(LIST_SELECT)
    .gte("event_date", anchorEventDate)
    .order("event_date", { ascending: true })
    .limit(ADMIN_EVENT_DAY_LIST_FROM_ANCHOR);

  const [calRes, beforeRes, fromRes] = await Promise.all([
    calendarPromise,
    beforePromise,
    fromPromise,
  ]);

  const error = calRes.error ?? beforeRes.error ?? fromRes.error;

  const calendarRowsRaw = calRes.data ?? [];
  const beforeRaw = (beforeRes.data ?? []) as ListRow[];
  const fromRaw = (fromRes.data ?? []) as ListRow[];

  const calendarTruncated =
    calendarRowsRaw.length >= ADMIN_EVENT_DAY_CALENDAR_MAX;

  const beforeAsc = [...beforeRaw].reverse();
  const list: ListRow[] = [...beforeAsc, ...fromRaw];

  const listHasMoreBefore = beforeRaw.length >= ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR;
  const listHasMoreFrom = fromRaw.length >= ADMIN_EVENT_DAY_LIST_FROM_ANCHOR;
  const listHasMore = listHasMoreBefore || listHasMoreFrom;

  const calendarDays = calendarRowsRaw.map((r) => ({
    id: r.id,
    event_date: r.event_date,
    grade_band: r.grade_band,
    status: r.status,
  }));

  /** デフォルトは「今日基準」なのでカレンダーも今月から。選択時はその開催日の月へ */
  const calendarInitialMonth = explicitAnchor
    ? yearMonthFromIsoDate(anchorEventDate)
    : tokyoYearMonthNow();

  if (error) {
    return (
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
          開催日管理
        </h1>
        <p className="mt-2 wrap-break-word text-sm text-red-600">
          一覧の取得に失敗しました: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 sm:text-2xl">
        開催日管理
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        公開前のまま作成後、「公開」にすると一般向けカレンダー（GET /api/event-days）に載ります。締切後・確定後も日付は表示されます（新規予約は open のみ）。
        誤って作った公開前の開催日は「削除」から削除できます（確認のあと、予約が無い場合のみ）。
        締切ロック（<code className="text-xs">locked</code>）は運用では自動ジョブで行う想定のため、ここには手動ボタンを出していません。
      </p>

      <CreateEventDayForm />

      {calendarDays.length > 0 ? (
        <section className="mb-8" aria-labelledby="admin-event-calendar-heading">
          <h2
            id="admin-event-calendar-heading"
            className="mb-2 text-base font-medium text-zinc-900 sm:text-lg"
          >
            開催カレンダー
          </h2>
          <p className="mb-3 text-xs text-zinc-500 sm:text-sm">
            ① 初回表示は今日（東京）を基準にした月です。②
            カレンダーで日付をタップすると、その日が一覧の
            <strong className="font-medium text-zinc-700">基準開催日</strong>
            になります。一覧はいつも「基準日より前（過去側）最大{" "}
            {ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR} 件」＋「基準日以降（未来側）最大{" "}
            {ADMIN_EVENT_DAY_LIST_FROM_ANCHOR} 件」です（区切りは
            <strong className="font-medium text-zinc-700">開催日</strong>
            。締切時刻では並べていません）。
          </p>
          <AdminEventDaysCompactCalendar
            key={`${anchorEventDate}-${explicitAnchor ? "1" : "0"}`}
            days={calendarDays}
            initialYearMonth={calendarInitialMonth}
            anchorEventDate={anchorEventDate}
          />
          {calendarTruncated ? (
            <p className="mt-2 text-xs text-amber-800 sm:text-sm">
              開催が多いため、カレンダー用データは先頭から最大{" "}
              {ADMIN_EVENT_DAY_CALENDAR_MAX} 件までに制限しています。
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="admin-event-list-heading">
        <h2
          id="admin-event-list-heading"
          className="mb-3 text-base font-medium text-zinc-900 sm:text-lg"
        >
          一覧
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-zinc-600 sm:text-sm">
          <span className="font-medium text-zinc-800">① デフォルト</span>
          ：URL に日付が無いときは東京の今日（
          <span className="tabular-nums">{todayTokyo}</span>
          ）を基準開催日にします。
          <span className="font-medium text-zinc-800"> ② カレンダー選択時</span>
          ：選んだ開催日を基準にします。いずれも一覧は「
          <strong className="text-zinc-800">直近の過去側</strong>（開催日が基準より前・新しい順で最大{" "}
          {ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR} 件）」と「
          <strong className="text-zinc-800">基準日以降</strong>（最大{" "}
          {ADMIN_EVENT_DAY_LIST_FROM_ANCHOR} 件）」です。現在の基準は{" "}
          <span className="font-medium text-zinc-800">
            {formatIsoDateWithWeekdayJa(anchorEventDate)}
          </span>
          。
          {explicitAnchor ? (
            <>
              {" "}
              <Link
                href="/admin/event-days"
                className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
              >
                ① 今日基準に戻す
              </Link>
            </>
          ) : null}
        </p>
        {listHasMore ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 sm:text-sm">
            {listHasMoreBefore && listHasMoreFrom
              ? "基準より前・以降の両方で表示上限に達している可能性があります。別の開催日をカレンダーで選ぶと続きが見えます。"
              : listHasMoreFrom
                ? "この基準日以降はまだ開催があります。次の枠はより後の開催日をカレンダーで選ぶと表示されます。"
                : "この基準日より前にも開催があります。より前の開催日をカレンダーで選ぶと表示されます。"}
          </p>
        ) : null}
        {list.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500">
            {calendarDays.length === 0 ? (
              <p>まだ開催日がありません</p>
            ) : (
              <p className="px-4">
                この基準日の前後に該当する開催がありません。カレンダーで別の日を選ぶか、開催日データを確認してください。
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {list.map((row) => (
                <EventDayMobileCard key={row.id} row={row} />
              ))}
            </div>
            <div className="hidden md:block">
              <p className="mb-2 text-xs text-zinc-500 lg:hidden">
                表がはみ出す場合は横にスクロールできます。
              </p>
              <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-white pb-1 [-webkit-overflow-scrolling:touch]">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full min-w-xl text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                          開催日
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                          学年帯
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                          状態
                        </th>
                        <th
                          className="min-w-40 px-3 py-2 font-medium text-zinc-700 lg:min-w-0"
                          title="UTC で保存。表示は東京日時"
                        >
                          <span className="hidden lg:inline">
                            締切（UTC 保存・表示は ISO）
                          </span>
                          <span className="lg:hidden">締切</span>
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                          枠 / 天候
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => (
                        <tr
                          key={row.id}
                          id={`admin-event-day-table-${row.id}`}
                          className={`scroll-mt-20 border-b border-zinc-100 ${
                            row.status === "open"
                              ? "bg-emerald-50/80"
                              : row.status === "draft"
                                ? "bg-white"
                                : "bg-zinc-50/80"
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-900">
                            {formatIsoDateWithWeekdayJa(row.event_date)}
                          </td>
                          <td className="px-3 py-2 text-zinc-800">
                            {row.grade_band}
                          </td>
                          <td className="px-3 py-2">
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
                          </td>
                          <td className="max-w-44 px-3 py-2 text-xs leading-snug text-zinc-600 lg:max-w-none">
                            {formatDateTimeTokyoWithWeekday(
                              row.reservation_deadline_at
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3">
                              <Link
                                href={`/admin/event-days/${row.id}/slots`}
                                className="text-sm font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
                              >
                                枠・時刻
                              </Link>
                              <Link
                                href={`/admin/event-days/${row.id}/weather`}
                                className="text-sm font-medium text-sky-800 underline decoration-sky-600/60 underline-offset-2 hover:text-sky-950"
                              >
                                雨天判断
                              </Link>
                              <Link
                                href={`/admin/event-days/${row.id}/operational-cancel`}
                                className="text-sm font-medium text-rose-800 underline decoration-rose-600/60 underline-offset-2 hover:text-rose-950"
                              >
                                緊急中止
                              </Link>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <EventDayRowActions
                              id={row.id}
                              status={row.status as EventDayAdminStatus}
                              eventDate={row.event_date}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
