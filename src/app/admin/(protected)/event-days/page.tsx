/** 開催日管理: 一覧（サーバー取得）・追加フォーム・行ごとの公開／下書き。 */
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

import { CreateEventDayForm } from "./create-event-day-form";
import { EventDayRowActions } from "./event-day-row-actions";

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
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">開催日管理</h1>
        <p className="mt-2 text-red-600">一覧の取得に失敗しました: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">開催日管理</h1>
      <p className="mb-6 text-sm text-zinc-600">
        下書きで作成後、公開にすると一般向け API に載せられます（GET /api/event-days）。
      </p>

      <CreateEventDayForm />

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">一覧</h2>
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-700">開催日</th>
                <th className="px-3 py-2 font-medium text-zinc-700">学年帯</th>
                <th className="px-3 py-2 font-medium text-zinc-700">状態</th>
                <th className="px-3 py-2 font-medium text-zinc-700">締切（UTC 保存・表示は ISO）</th>
                <th className="px-3 py-2 font-medium text-zinc-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    まだ開催日がありません
                  </td>
                </tr>
              ) : (
                (rows ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2 text-zinc-900">
                      {formatIsoDateWithWeekdayJa(row.event_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">{row.grade_band}</td>
                    <td className="px-3 py-2 text-zinc-800">{row.status}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      {formatDateTimeTokyoWithWeekday(row.reservation_deadline_at)}
                    </td>
                    <td className="px-3 py-2">
                      <EventDayRowActions id={row.id} status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
