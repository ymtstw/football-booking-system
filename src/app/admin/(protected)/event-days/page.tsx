/** 開催日管理: 一覧（サーバー取得）・追加フォーム・行ごとの公開前／公開。 */
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

import { CreateEventDayForm } from "./create-event-day-form";
import { EventDayMobileCard } from "./event-day-mobile-card";
import { eventDayStatusLabelJa } from "./event-day-status-label";
import {
  EventDayRowActions,
  type EventDayAdminStatus,
} from "./event-day-row-actions";

export default async function AdminEventDaysPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, reservation_deadline_at, created_at"
    )
    .order("event_date", { ascending: true });

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
        公開前のまま作成後、「公開」にすると一般向け API に載せられます（GET /api/event-days）。
        誤って作った公開前の開催日は「削除」から削除できます（確認のあと、予約が無い場合のみ）。
      </p>

      <CreateEventDayForm />

      <section>
        <h2 className="mb-3 text-base font-medium text-zinc-900 sm:text-lg">
          一覧
        </h2>
        {(rows ?? []).length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500">
            まだ開催日がありません
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {(rows ?? []).map((row) => (
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
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows ?? []).map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-zinc-100 ${
                            row.status === "open"
                              ? "bg-emerald-50/80"
                              : row.status === "draft"
                                ? "bg-white"
                                : ""
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
