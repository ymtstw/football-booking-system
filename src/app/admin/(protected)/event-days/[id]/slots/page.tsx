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
      ? `即時通知: 送信処理済み ${imSentRaw} 件、送らなかった ${imSkipRaw} 件（通知メールの設定がない・すでに送付済みなど）。`
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
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold text-sky-950">登録完了しました。</p>
          <p className="mt-1 leading-relaxed text-sky-900/95">
            天候対応の登録が完了しました。原則、参加者向けの最終文面は前日の一括メール（16:30頃開始）に反映されます。
            送信状況により、到着まで数分程度かかる場合があります。
          </p>
          {imLine ? (
            <p className="mt-2 text-xs leading-relaxed text-sky-900/90">{imLine}</p>
          ) : null}
          <p className="mt-3">
            <Link
              href={`/admin/event-days/${id}/slots`}
              className="text-sm font-medium text-sky-900 underline underline-offset-2 hover:text-sky-950"
            >
              この通知を閉じる（通常表示に戻す）
            </Link>
          </p>
        </div>
      ) : null}
      {operationalDone ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold text-sky-950">登録完了しました。</p>
          <p className="mt-1 leading-relaxed text-sky-900/95">
            運営都合による緊急中止を登録しました。原則、入力したお知らせ文は前日の一括メール（16:30頃開始）に反映されます。
            送信状況により、到着まで数分程度かかる場合があります。
          </p>
          {imLine ? (
            <p className="mt-2 text-xs leading-relaxed text-sky-900/90">{imLine}</p>
          ) : null}
          <p className="mt-3">
            <Link
              href={`/admin/event-days/${id}/slots`}
              className="text-sm font-medium text-sky-900 underline underline-offset-2 hover:text-sky-950"
            >
              この通知を閉じる（通常表示に戻す）
            </Link>
          </p>
        </div>
      ) : null}
      <div>
        <EventDayOpsBreadcrumb eventDayId={id} items={[{ label: "枠・時刻設定" }]} />
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          枠・時刻設定
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
          <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-700 sm:text-sm">
            締切済み・確定などのため、この画面から枠の追加・時刻変更はできません（参照のみ）。
          </p>
        ) : activeReservationCount > 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-zinc-600 sm:text-sm">
            有効な予約があるため、この画面では保存できません。時刻の確認と通常外の変更は、下の「枠運用について」内の案内に従ってください。
          </p>
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
