"use client";

/** 開催日・学年帯・締切を入力し下書き作成。POST /api/admin/event-days（6枠付与は API 側）。 */
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
    <section className="mb-10 rounded border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-medium text-zinc-900">開催日を追加</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">開催日</span>
          <input
            name="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => onEventDateChange(e.target.value)}
            required
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">学年帯</span>
          <select
            name="gradeBand"
            value={gradeBand}
            onChange={(e) => setGradeBand(e.target.value)}
            required
            className="min-w-34 rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900"
          >
            {GRADE_BAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="text-zinc-600">予約締切（ローカル時刻）</span>
          <input
            name="deadlineLocal"
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            required
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "作成中…" : "下書きで作成（6枠付与）"}
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
