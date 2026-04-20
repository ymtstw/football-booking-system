"use client";

/** 開催日・学年帯・締切を入力し公開前（draft）で作成。POST /api/admin/event-days（既定枠付与は API 側）。 */
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { DEFAULT_ACTIVE_EVENT_DAY_SLOT_COUNT } from "@/domains/event-days/default-slots";
import { defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst } from "@/lib/dates/reservation-deadline-default";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 開催日の 2 日前 15:00（JST）締切を `datetime-local` 用に組み立て（ブラウザローカル表示）。 */
function defaultDeadlineLocalForEventDate(eventDate: string): string {
  const iso = defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst(eventDate);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** DB は text だが、UI では仕様どおりの値だけ選べるようにする（MVP。仕様は docs/spec/implemented-behavior-catalog.md）。 */
const GRADE_BAND_OPTIONS = [
  { value: "1-2", label: "1-2年生" },
  { value: "3-4", label: "3-4年生" },
  { value: "5-6", label: "5-6年生" },
] as const;

export function CreateEventDayForm() {
  const router = useRouter();
  const [eventDate, setEventDate] = useState("");
  const [gradeBand, setGradeBand] = useState("3-4");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onEventDateChange(v: string) {
    setEventDate(v);
    if (v) setDeadlineLocal(defaultDeadlineLocalForEventDate(v));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const eventDateVal = (form.elements.namedItem("eventDate") as HTMLInputElement)
      .value;
    const gradeBandVal = (form.elements.namedItem("gradeBand") as HTMLSelectElement)
      .value;
    const deadlineVal = (
      form.elements.namedItem("deadlineLocal") as HTMLInputElement
    ).value;
    if (!eventDateVal || !deadlineVal) {
      setMessage("開催日と締切を入力してください");
      return;
    }
    if (!gradeBandVal) {
      setMessage("学年帯を選択してください");
      return;
    }
    setLoading(true);
    const reservationDeadlineAt = new Date(deadlineVal).toISOString();
    const res = await fetch("/api/admin/event-days", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDate: eventDateVal,
        gradeBand: gradeBandVal,
        reservationDeadlineAt,
        status: "draft",
      }),
    });
    setLoading(false);
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!res.ok) {
      setMessage(json.error ?? `エラー（${res.status}）`);
      return;
    }
    setEventDate("");
    setGradeBand("3-4");
    setDeadlineLocal("");
    setMessage("作成しました");
    router.refresh();
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
            作成
          </span>
          <h2
            id="admin-create-event-day-heading"
            className="text-base font-bold text-zinc-900 sm:text-lg"
          >
            開催日を新規作成
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-zinc-600 sm:text-sm">
          このフォームで開催日データを追加します（最初は<strong className="font-medium text-zinc-800">公開前</strong>。
          一般公開は下の一覧から「公開」）。
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
            onChange={(e) => onEventDateChange(e.target.value)}
            required
            className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:min-h-10 sm:text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[8.5rem] sm:flex-none">
          <span className="text-zinc-600">学年帯</span>
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
        <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:min-w-[min(100%,14rem)] sm:w-auto sm:flex-1">
          <span className="text-zinc-600">
            予約締切（既定: 開催 2 日前 15:00・ローカル表示）
          </span>
          <DateInputWithPicker
            name="deadlineLocal"
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            required
            className="min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:min-h-10 sm:text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2.5 text-center text-sm font-semibold leading-snug text-white whitespace-normal shadow-sm ring-1 ring-emerald-900/20 hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-50 sm:w-auto sm:self-end sm:px-4 sm:leading-normal"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "作成中…" : `公開前で作成（${DEFAULT_ACTIVE_EVENT_DAY_SLOT_COUNT}枠運用で開始）`}
        </button>
      </form>
      {message ? (
        <p className={`mt-2 text-sm ${message.startsWith("作成") ? "text-green-700" : "text-red-600"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
