"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type WeatherEventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
};

export function WeatherDecisionForm({ eventDay }: { eventDay: WeatherEventDayRow }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"go" | "cancel" | "">("");
  const [notes, setNotes] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) {
      setMessage("判断（実施 / 中止）を選んでください");
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event-days/${eventDay.id}/weather-decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes.trim() || undefined,
          sendImmediateCancelNotice: decision === "cancel" ? immediate : false,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        immediateNotice?: { sent: number; skipped: number };
      };
      if (!res.ok) {
        setMessage(json.error ?? `エラー（${res.status}）`);
        return;
      }
      const im = json.immediateNotice;
      setMessage(
        im
          ? `保存しました。即時通知: 送信 ${im.sent} 件、スキップ ${im.skipped} 件（メール未設定・送信済み等）。`
          : "保存しました。標準運用では前日 13:30 の一括通知に反映されます。"
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-zinc-800">
          {formatIsoDateWithWeekdayJa(eventDay.event_date)}（{eventDay.grade_band}）
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          状態: {eventDay.status}
          {eventDay.weather_status ? ` ／ 天候フラグ: ${eventDay.weather_status}` : ""}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800">天候判断</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="decision"
            value="go"
            checked={decision === "go"}
            onChange={() => setDecision("go")}
          />
          実施（go）
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="decision"
            value="cancel"
            checked={decision === "cancel"}
            onChange={() => setDecision("cancel")}
          />
          中止（cancel）
        </label>
      </fieldset>

      <div>
        <label htmlFor="wd-notes" className="block text-sm font-medium text-zinc-800">
          メモ（参加者向けメールに載る場合があります）
        </label>
        <textarea
          id="wd-notes"
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="例: 午前中の雨のため人工芝は使用可、試合は実施"
        />
      </div>

      {decision === "cancel" ? (
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={immediate}
            onChange={(ev) => setImmediate(ev.target.checked)}
            className="mt-1"
          />
          <span>
            <strong>例外:</strong> 至急、雨天中止のみのメールを即時送信する（荒天など必要時のみ。通常は前日
            13:30 の最終版に含めます）
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={loading || !decision}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? <InlineSpinner variant="onDark" /> : null}
        {loading ? "送信中…" : "登録する"}
      </button>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </form>
  );
}
