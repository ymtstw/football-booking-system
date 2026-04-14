"use client";

/** 開催日・学年帯・締切を入力し公開前（draft）で作成。POST /api/admin/event-days（既定枠付与は API 側）。 */
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { DEFAULT_EVENT_DAY_SLOT_COUNT } from "@/domains/event-days/default-slots";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 開催日前日 13:00（JST）の締切を `datetime-local` 用に組み立て（ローカル表示）。 */
function defaultDeadlineLocalForEventDate(eventDate: string): string {
  const d = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  prev.setHours(13, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}T${pad(prev.getHours())}:${pad(prev.getMinutes())}`;
}

/** DB は text だが、UI では仕様どおりの値だけ選べるようにする（MVP / design-mvp と一致）。 */
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
    <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm sm:mb-10 sm:p-4">
      <h2 className="mb-3 text-base font-medium text-zinc-900 sm:text-lg">
        開催日を追加
      </h2>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[9rem] sm:flex-none">
          <span className="text-zinc-600">開催日</span>
          <input
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
          <span className="text-zinc-600">予約締切（ローカル時刻）</span>
          <input
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
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-sm font-medium leading-snug text-white whitespace-normal disabled:cursor-wait disabled:opacity-50 sm:w-auto sm:self-end sm:px-4 sm:leading-normal"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "作成中…" : `公開前で作成（${DEFAULT_EVENT_DAY_SLOT_COUNT}枠付与）`}
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
