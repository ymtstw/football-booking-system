"use client";

import Link from "next/link";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { eventDayStatusLabelJa } from "../../event-day-status-label";

export type WeatherEventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
  /** 雨天中止にした直前の status。取り消し可否の判定に使う */
  status_before_weather_cancel: string | null;
};

export function WeatherDecisionForm({ eventDay }: { eventDay: WeatherEventDayRow }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"go" | "cancel" | "">("");
  const [notes, setNotes] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [cancelDelivery, setCancelDelivery] = useState<"immediate" | "day_before_17">(
    "immediate"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const prev = eventDay.status_before_weather_cancel ?? null;
  const showUndoRain =
    eventDay.status === "cancelled_weather" && prev !== "confirmed";
  const showRainFrozen =
    eventDay.status === "cancelled_weather" && prev === "confirmed";

  async function postDecision(payload: {
    decision: "go" | "cancel";
    notes?: string;
    sendImmediateCancelNotice?: boolean;
    delivery?: "immediate" | "day_before_17";
  }) {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event-days/${eventDay.id}/weather-decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      const qs = new URLSearchParams({ weatherRegistered: "1" });
      if (im) {
        qs.set("imSent", String(im.sent));
        qs.set("imSkip", String(im.skipped));
      }
      router.push(`/admin/event-days/${eventDay.id}/slots?${qs.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) {
      setMessage("判断（実施 / 中止）を選んでください");
      return;
    }
    const isCancel = decision === "cancel";
    await postDecision({
      decision,
      notes: notes.trim() || undefined,
      sendImmediateCancelNotice: isCancel && cancelDelivery === "immediate" ? immediate : false,
      delivery: isCancel ? cancelDelivery : undefined,
    });
  }

  async function handleUndoRainCancel(e: React.FormEvent) {
    e.preventDefault();
    const ok = window.confirm(
      "雨天中止を取りやめ、中止前の状態（公開中または締切済）に戻します。よろしいですか？"
    );
    if (!ok) return;
    await postDecision({
      decision: "go",
      notes: notes.trim() || undefined,
      sendImmediateCancelNotice: false,
      delivery: "immediate",
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link
          href={`/admin/event-days/${eventDay.id}/notifications`}
          className="font-medium text-indigo-800 underline decoration-indigo-600/60 underline-offset-2"
        >
          通知・送信状況を見る
        </Link>
      </p>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-800">
          {formatIsoDateWithWeekdayJa(eventDay.event_date)}（{eventDay.grade_band}）
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          状態: {eventDayStatusLabelJa(eventDay.status)}
          {eventDay.weather_status ? ` ／ 天候フラグ: ${eventDay.weather_status}` : ""}
        </p>
      </div>

      {showRainFrozen ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">雨天中止は取り消せません</p>
          <p className="mt-1 text-xs leading-relaxed">
            編成確定（confirmed）後に雨天中止したため、画面からは元に戻せません。必要ならデータ修正や別連絡で対応してください。
          </p>
        </div>
      ) : null}

      {showUndoRain ? (
        <form
          onSubmit={(ev) => void handleUndoRainCancel(ev)}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-zinc-900">雨天中止の取り消し</p>
          <p className="text-xs leading-relaxed text-zinc-600">
            締切ロック前（公開中・締切済）に登録した雨天中止だけ、ここから実施に戻せます。
          </p>
          <div>
            <label htmlFor="wd-undo-notes" className="block text-sm font-medium text-zinc-800">
              メモ（任意・履歴に残ります）
            </label>
            <textarea
              id="wd-undo-notes"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="取り消し理由や連絡事項があれば入力"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-400 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading ? <InlineSpinner /> : null}
            {loading ? "送信中…" : "雨天中止を取り消す（実施に戻す）"}
          </button>
          {message ? <p className="text-sm text-red-700">{message}</p> : null}
        </form>
      ) : null}

      {!showUndoRain && !showRainFrozen ? (
        <form
          onSubmit={(ev) => void handleSubmit(ev)}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
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
            <fieldset className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
              <legend className="text-sm font-medium text-zinc-800">雨天中止の伝え方</legend>
              <label className="flex items-start gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="cancelDelivery"
                  checked={cancelDelivery === "immediate"}
                  onChange={() => {
                    setCancelDelivery("immediate");
                  }}
                  className="mt-1"
                />
                <span>
                  <strong>即時に確定</strong>
                  ：開催日を雨天中止として確定します。必要なら下の「即時メール」で参加者へすぐ送れます。
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="cancelDelivery"
                  checked={cancelDelivery === "day_before_17"}
                  onChange={() => {
                    setCancelDelivery("day_before_17");
                    setImmediate(false);
                  }}
                  className="mt-1"
                />
                <span>
                  <strong>前日 17:00 に送信</strong>
                  ：開催前日の最終メール（Cron）で雨天中止文面を送ります。即時確定はしません（二重送信しません）。
                </span>
              </label>
              {cancelDelivery === "immediate" ? (
                <label className="ml-6 flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={immediate}
                    onChange={(ev) => setImmediate(ev.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <strong>例外:</strong> 至急、雨天中止のみのメールを即時送信する（荒天・雷・グラウンド不可など）
                  </span>
                </label>
              ) : null}
            </fieldset>
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
      ) : null}
    </div>
  );
}
