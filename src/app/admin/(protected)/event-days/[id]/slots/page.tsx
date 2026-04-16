/** 開催日1件の枠一覧・時刻・有効化の編集（draft/open かつ予約0件のみ通常編集可）。 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

import { eventDayStatusLabelJa } from "../../event-day-status-label";
import { SlotsEditorClient } from "./slots-editor-client";

export default async function AdminEventDaySlotsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: day, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !day) {
    notFound();
  }

  const { data: slots, error: sErr } = await supabase
    .from("event_day_slots")
    .select(
      "id, slot_code, phase, start_time, end_time, capacity, is_active, is_time_changed, is_locked"
    )
    .eq("event_day_id", id)
    .order("start_time", { ascending: true });
  if (sErr) {
    throw new Error(sErr.message);
  }

  const { count: activeReservationCountRaw, error: cErr } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("event_day_id", id)
    .eq("status", "active");
  if (cErr) {
    throw new Error(cErr.message);
  }
  const activeReservationCount = activeReservationCountRaw ?? 0;

  const statusAllowsEdit = day.status === "draft" || day.status === "open";
  const editable =
    statusAllowsEdit && activeReservationCount === 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">
          <Link
            href="/admin/event-days"
            className="text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
          >
            開催日一覧
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          枠・時刻
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          <span className="font-medium text-zinc-800">
            {formatIsoDateWithWeekdayJa(day.event_date)}
          </span>
          <span className="mx-1.5 text-zinc-400">·</span>
          <span>{day.grade_band}</span>
          <span className="mx-1.5 text-zinc-400">·</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
            {eventDayStatusLabelJa(day.status)}
          </span>
        </p>
        {!statusAllowsEdit ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-900 sm:text-sm">
            この開催日は締切済み・確定などのため、枠の追加・時刻変更はできません（参照のみ）。
          </p>
        ) : activeReservationCount > 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-900 sm:text-sm">
            アクティブな予約が{" "}
            <span className="font-semibold">{activeReservationCount}</span>{" "}
            件あるため、通常の枠編集（時刻・有効・追加）はできません。やむを得ない変更は
            <Link
              href={`/admin/event-days/${id}/slots/force`}
              className="mx-1 font-medium text-amber-950 underline decoration-amber-700/60 underline-offset-2 hover:text-amber-900"
            >
              枠の強制変更（別確認）
            </Link>
            から行ってください。
          </p>
        ) : null}
      </div>

      <SlotsEditorClient
        eventDayId={id}
        initialSlots={slots ?? []}
        editable={editable}
      />
    </div>
  );
}
