/** 開催日1件の枠一覧・時刻・有効化の編集（draft/open かつ予約0件のみ通常編集可）。 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

import { EventDayOpsBreadcrumb } from "../../event-day-ops-breadcrumb";
import { eventDayStatusLabelJa } from "../../event-day-status-label";
import { SlotsEditorClient } from "./slots-editor-client";

export default async function AdminEventDaySlotsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    weatherRegistered?: string | string[];
    operationalRegistered?: string | string[];
    imSent?: string | string[];
    imSkip?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const weatherDone =
    typeof sp.weatherRegistered === "string" && sp.weatherRegistered === "1";
  const operationalDone =
    typeof sp.operationalRegistered === "string" && sp.operationalRegistered === "1";
  const imSentRaw =
    typeof sp.imSent === "string" ? Number.parseInt(sp.imSent, 10) : NaN;
  const imSkipRaw =
    typeof sp.imSkip === "string" ? Number.parseInt(sp.imSkip, 10) : NaN;
  const imLine =
    (weatherDone || operationalDone) &&
    Number.isFinite(imSentRaw) &&
    Number.isFinite(imSkipRaw) &&
    !Number.isNaN(imSentRaw) &&
    !Number.isNaN(imSkipRaw)
      ? `即時通知: 送信 ${imSentRaw} 件、スキップ ${imSkipRaw} 件（メール未設定・送信済み等）。`
      : null;
  const supabase = await createClient();
  const { data: day, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
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
      {weatherDone ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">登録完了しました。</p>
          <p className="mt-1 leading-relaxed">
            雨天判断の登録が完了しました。原則、参加者向けの最終文面は前日の一括メール（16:30頃開始・目安17:30まで）に反映されます。
          </p>
          {imLine ? (
            <p className="mt-2 text-xs leading-relaxed text-emerald-900/95">
              {imLine}
            </p>
          ) : null}
          <p className="mt-3">
            <Link
              href={`/admin/event-days/${id}/slots`}
              className="text-sm font-medium text-emerald-900 underline underline-offset-2 hover:text-emerald-950"
            >
              このメッセージを閉じる（URL からパラメータを外す）
            </Link>
          </p>
        </div>
      ) : null}
      {operationalDone ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-semibold">登録完了しました。</p>
          <p className="mt-1 leading-relaxed">
            運営都合による緊急中止を登録しました。原則、入力したお知らせ文は前日の一括メール（16:30頃開始・目安17:30まで）に反映されます。
          </p>
          {imLine ? (
            <p className="mt-2 text-xs leading-relaxed text-rose-900/95">
              {imLine}
            </p>
          ) : null}
          <p className="mt-3">
            <Link
              href={`/admin/event-days/${id}/slots`}
              className="text-sm font-medium text-rose-900 underline underline-offset-2 hover:text-rose-950"
            >
              このメッセージを閉じる（URL からパラメータを外す）
            </Link>
          </p>
        </div>
      ) : null}
      <div>
        <EventDayOpsBreadcrumb
          eventDayId={id}
          items={[
            { href: `/admin/event-days/${id}/weather`, label: "雨天判断" },
            { href: `/admin/event-days/${id}/operational-cancel`, label: "緊急中止（運営）" },
            { href: `/admin/event-days/${id}/notifications`, label: "通知・送信状況" },
            { label: "枠・時刻" },
          ]}
        />
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
          <div
            role="alert"
            className="mt-4 rounded-xl border-2 border-amber-400/90 bg-amber-50 px-4 py-4 shadow-sm sm:px-5 sm:py-5"
          >
            <p className="text-base font-bold leading-snug text-amber-950 sm:text-lg">
              有効な予約があるため、この画面からの通常の枠編集はできません
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-900 sm:text-base">
              <span className="block sm:inline">アクティブな予約が</span>{" "}
              <span className="my-1 inline-flex items-baseline gap-0.5 rounded-md bg-amber-100/90 px-2.5 py-1 align-middle ring-1 ring-amber-300/80 sm:my-0">
                <span className="text-2xl font-extrabold tabular-nums text-amber-950 sm:text-3xl">
                  {activeReservationCount}
                </span>
                <span className="text-sm font-semibold text-amber-900 sm:text-base">件</span>
              </span>{" "}
              <span className="block sm:inline">
                あるため、時刻の変更・枠の有効/無効・枠の追加はこの画面では行えません。
              </span>
            </p>
            <div className="mt-4 border-t border-amber-200 pt-4">
              <p className="text-sm font-semibold text-amber-950 sm:text-base">
                やむを得ない変更が必要な場合
              </p>
              <Link
                href={`/admin/event-days/${id}/slots/force`}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-amber-950 sm:w-auto sm:min-w-[16rem] sm:text-base"
              >
                枠の強制変更へ（別画面・確認あり）
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <SlotsEditorClient
        eventDayId={id}
        initialSlots={slots ?? []}
        editable={editable}
        activeReservationCount={activeReservationCount}
        reservationDeadlineAt={String(day.reservation_deadline_at ?? "")}
      />
    </div>
  );
}
