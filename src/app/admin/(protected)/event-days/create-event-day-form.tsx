"use client";

/** 開催日・学年帯を入力し公開前（draft）で作成。作成直後に公開確認モーダルを出す。POST /api/admin/event-days。 */
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst } from "@/lib/dates/reservation-deadline-default";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const GRADE_BAND_OPTIONS = [
  { value: "1-2", label: "1-2年生" },
  { value: "3-4", label: "3-4年生" },
  { value: "5-6", label: "5-6年生" },
] as const;

export function CreateEventDayForm() {
  const router = useRouter();
  const [eventDate, setEventDate] = useState("");
  const [gradeBand, setGradeBand] = useState("3-4");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [createdDay, setCreatedDay] = useState<{ id: string; eventDate: string } | null>(
    null
  );
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [completionBanner, setCompletionBanner] = useState<string | null>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const createdDayRef = useRef(createdDay);
  createdDayRef.current = createdDay;

  const declinePublish = useCallback(() => {
    const d = createdDayRef.current;
    setPublishDialogOpen(false);
    setCreatedDay(null);
    if (d) {
      const label = formatIsoDateWithWeekdayJa(d.eventDate);
      setCompletionBanner(`「${label}」の開催日を作成しました。`);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    if (!publishDialogOpen || publishBusy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        declinePublish();
      }
    };
    window.addEventListener("keydown", onKey);
    queueMicrotask(() => yesButtonRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [publishDialogOpen, publishBusy, declinePublish]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setCompletionBanner(null);
    const form = e.currentTarget;
    const eventDateVal = (form.elements.namedItem("eventDate") as HTMLInputElement)
      .value;
    const gradeBandVal = (form.elements.namedItem("gradeBand") as HTMLSelectElement)
      .value;
    if (!eventDateVal) {
      setMessage("開催日を入力してください");
      return;
    }
    if (!gradeBandVal) {
      setMessage("対象学年を選択してください");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/event-days", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDate: eventDateVal,
        gradeBand: gradeBandVal,
        status: "draft",
      }),
    });
    setLoading(false);
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      eventDay?: { id: string; event_date: string };
    };
    if (!res.ok) {
      setMessage(json.error ?? "作成に失敗しました。入力内容を確認するか、時間をおいて再度お試しください。");
      return;
    }
    const day = json.eventDay;
    if (!day?.id || !day.event_date) {
      setMessage("作成は完了した可能性があります。一覧を更新してご確認ください。");
      router.refresh();
      return;
    }
    setEventDate("");
    setGradeBand("3-4");
    setPublishError(null);
    setCreatedDay({ id: day.id, eventDate: day.event_date });
    setPublishDialogOpen(true);
  }

  async function confirmPublish() {
    if (!createdDay) return;
    setPublishBusy(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/admin/event-days/${createdDay.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPublishError(
          j.error ?? "公開に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }
      const label = formatIsoDateWithWeekdayJa(createdDay.eventDate);
      setPublishDialogOpen(false);
      setCreatedDay(null);
      setCompletionBanner(`「${label}」の開催日を作成し、公開しました。`);
      router.refresh();
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="admin-create-event-day-heading"
      className="relative mb-8 overflow-hidden rounded-2xl border-2 border-emerald-200/90 bg-white p-4 shadow-md ring-1 ring-emerald-100/80 sm:mb-10 sm:p-5"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-700"
        aria-hidden
      />
      <div className="relative space-y-1 pl-3 sm:pl-4">
        <h2
          id="admin-create-event-day-heading"
          className="text-base font-bold text-zinc-900 sm:text-lg"
        >
          開催日を作成
        </h2>
        <p className="text-xs leading-relaxed text-zinc-600 sm:text-sm">
          開催日を登録すると、予約受付に必要な基本設定が作成されます。作成時に「公開する」「公開前で保存する」を選べます。予約締切は開催日の2日前15:00に自動設定されます。
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative mt-4 flex flex-col gap-3 border-t border-emerald-100/90 pt-4 pl-3 sm:flex-row sm:flex-wrap sm:items-end sm:pl-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[9rem] sm:flex-none">
          <span className="text-zinc-600">開催日</span>
          <DateInputWithPicker
            name="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
            className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:min-h-10 sm:text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[8.5rem] sm:flex-none">
          <span className="text-zinc-600">対象学年</span>
          <select
            name="gradeBand"
            value={gradeBand}
            onChange={(e) => setGradeBand(e.target.value)}
            required
            className="min-h-11 w-full min-w-0 rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-10 sm:text-sm"
          >
            {GRADE_BAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 w-full flex-col gap-1 text-sm sm:min-w-[min(100%,18rem)] sm:w-auto sm:flex-1">
          <span className="text-zinc-600">予約締切（自動設定）</span>
          <p className="min-h-11 rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm leading-snug text-zinc-800 sm:min-h-10">
            {eventDate.trim()
              ? formatDateTimeTokyoWithWeekday(
                  defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst(eventDate.trim())
                )
              : "開催日を選択すると自動で表示されます"}
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2.5 text-center text-sm font-semibold leading-snug text-white whitespace-normal shadow-sm ring-1 ring-emerald-900/20 hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-50 sm:w-auto sm:self-end sm:px-4 sm:leading-normal"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "作成中…" : "公開前で作成"}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}

      {completionBanner ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-950"
        >
          {completionBanner}
        </div>
      ) : null}

      {publishDialogOpen && createdDay ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-[1px]"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-dialog-title"
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl ring-1 ring-zinc-200/80"
          >
            <h3
              id="publish-dialog-title"
              className="text-base font-bold text-zinc-900"
            >
              公開しますか？
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {formatIsoDateWithWeekdayJa(createdDay.eventDate)}
              </span>
              の開催日を作成しました。一般向けの予約カレンダーに載せる場合は
              <strong className="font-semibold text-zinc-900"> 公開して作成 </strong>
              を選んでください。
            </p>
            {publishError ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {publishError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={publishBusy}
                onClick={() => declinePublish()}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
              >
                公開前のまま閉じる
              </button>
              <button
                ref={yesButtonRef}
                type="button"
                disabled={publishBusy}
                onClick={() => void confirmPublish()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                {publishBusy ? <InlineSpinner variant="onDark" /> : null}
                {publishBusy ? "公開処理中…" : "公開して作成"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
