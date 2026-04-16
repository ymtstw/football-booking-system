import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { eventDayStatusLabelJa } from "../../event-day-status-label";
import { OperationalCancelForm } from "./operational-cancel-form";
import { OperationalRestoreButton } from "./operational-restore-button";

export default async function AdminEventDayOperationalCancelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: eventDay, error } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, operational_cancellation_notice, status_before_operational_cancel"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !eventDay) {
    notFound();
  }

  const st = eventDay.status as string;
  const blockedReason =
    st === "draft"
      ? "公開前の開催日では緊急中止を登録できません。"
      : st === "cancelled_minimum"
        ? "最少催行中止の開催日では緊急中止を登録できません。"
        : st === "cancelled_weather"
          ? "雨天中止が登録済みのため、運営中止は登録できません。"
          : st !== "open" && st !== "locked" && st !== "confirmed"
            ? "この状態からは緊急中止を登録できません。"
            : null;

  const alreadyOperational = st === "cancelled_operational";
  const noticeSaved =
    typeof eventDay.operational_cancellation_notice === "string"
      ? eventDay.operational_cancellation_notice.trim()
      : "";

  const opPrev =
    (eventDay as { status_before_operational_cancel?: string | null })
      .status_before_operational_cancel ?? null;
  const operationalUndoFrozen = alreadyOperational && opPrev === "confirmed";
  const operationalCanUndo = alreadyOperational && opPrev !== "confirmed";

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="mb-4 text-sm text-zinc-600">
        <Link
          href="/admin/event-days"
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          開催日一覧
        </Link>
        {" · "}
        <Link
          href={`/admin/event-days/${id}/slots`}
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          枠・時刻
        </Link>
        {" · "}
        <Link
          href={`/admin/event-days/${id}/weather`}
          className="font-medium text-sky-800 underline decoration-sky-600/60 underline-offset-2"
        >
          雨天判断
        </Link>
      </p>
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">緊急中止（運営の都合）</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        雨天とは別枠です。登録すると開催日は<strong>運営都合中止</strong>となり、参加者向けメールにはここで入力した文面が載ります（原則は前日
        17:00 の一括メール）。天候による中止は{" "}
        <Link
          href={`/admin/event-days/${id}/weather`}
          className="font-medium text-sky-800 underline decoration-sky-600/60 underline-offset-2"
        >
          雨天判断
        </Link>{" "}
        から登録してください。
      </p>

      <p className="mb-4 text-xs text-zinc-500">
        現在の状態:{" "}
        <span className="font-medium text-zinc-700">{eventDayStatusLabelJa(st)}</span>
      </p>

      {alreadyOperational ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          <p className="font-medium">すでに運営都合中止として登録済みです。</p>
          {noticeSaved ? (
            <pre className="mt-3 whitespace-pre-wrap wrap-break-word rounded border border-zinc-200 bg-white p-3 text-xs leading-relaxed">
              {noticeSaved}
            </pre>
          ) : null}
          {operationalUndoFrozen ? (
            <p className="mt-4 text-xs leading-relaxed text-amber-900">
              編成確定後に運営中止したため、画面からは取り消せません。
            </p>
          ) : null}
          {operationalCanUndo ? <OperationalRestoreButton eventDayId={eventDay.id} /> : null}
        </div>
      ) : blockedReason ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {blockedReason}
        </p>
      ) : (
        <OperationalCancelForm
          eventDay={{
            id: eventDay.id,
            event_date: eventDay.event_date,
            grade_band: eventDay.grade_band,
            status: st,
          }}
        />
      )}
    </div>
  );
}
