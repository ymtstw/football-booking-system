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
  final_day_before_notice_completed_at?: string | null;
};

function weatherStatusDisplayJa(weatherStatus: string | null): string | null {
  const w = weatherStatus?.trim();
  if (!w) return null;
  if (w === "go") return "開催予定";
  if (w === "cancel") return "中止予定";
  return `天候メモ: ${w}`;
}

export function WeatherDecisionForm({ eventDay }: { eventDay: WeatherEventDayRow }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"go" | "cancel" | "">("");
  const [notes, setNotes] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [cancelDelivery, setCancelDelivery] = useState<"immediate" | "day_before_17">(
    "day_before_17"
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
        setMessage(json.error ?? "保存に失敗しました。内容を確認して再試行してください。");
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
      setMessage("判断（開催する / 中止する）を選んでください");
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
          状態:{" "}
          {eventDayStatusLabelJa(eventDay.status, {
            finalDayBeforeNoticeCompletedAt:
              eventDay.status === "confirmed"
                ? eventDay.final_day_before_notice_completed_at ?? null
                : null,
          })}
          {(() => {
            const s = weatherStatusDisplayJa(eventDay.weather_status);
            return s ? ` ／ ${s}` : "";
          })()}
        </p>
      </div>

      {showRainFrozen ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">雨天中止は取り消せません</p>
          <p className="mt-1 text-xs leading-relaxed">
            試合表が確定したあとに雨天中止したため、画面からは元に戻せません。必要ならデータ修正や別連絡で対応してください。
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
              開催する
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="decision"
                value="cancel"
                checked={decision === "cancel"}
                onChange={() => setDecision("cancel")}
              />
              中止する
            </label>
          </fieldset>

          <div>
            <label htmlFor="wd-notes" className="block text-sm font-medium text-zinc-800">
              メモ（任意・参加者向けメールへ差し込む場合があります）
            </label>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              入力があるときだけ、雨天中止メールの「ご了承ください」の直後に、そのまま続けて入ります（前日の自動送信・今すぐ送信のどちらでも同じ位置です）。
            </p>
            <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 text-[11px] leading-relaxed text-sky-950">
              <p className="font-semibold text-sky-900">送るメールの前後イメージ（抜粋）</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                {`件名：【小学生サッカー対戦予約】雨天中止のお知らせ

────────────────
（本文の例）

〇〇 様

このたびはお申し込みいただきありがとうございます。

雨天のため、下記の開催日は中止となります。

・チーム名：（予約のチーム名）
・開催日：（開催日・曜日）
・学年帯：（学年帯）

ご予定いただいていたところ恐れ入りますが、ご了承ください。

← メモ欄に入力があれば、ここにそのまま続きます（入力なしのときは省略）

こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。
ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。

よろしくお願いいたします。
────────────────`}
              </p>
            </div>
            <textarea
              id="wd-notes"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="（任意）参加者向けに追記する内容があれば入力"
            />
          </div>

          {decision === "cancel" ? (
            <fieldset className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
              <legend className="text-sm font-medium text-zinc-800">
                雨天中止の連絡（どちらか一方）
              </legend>
              <p className="text-xs leading-relaxed text-zinc-600">
                <strong className="text-zinc-800">①</strong> はこの画面の「登録する」では送らず、
                <strong className="text-zinc-800">開催前日に自動で一斉送信</strong>されます（届くのは目安{" "}
                <strong>16:30頃</strong>）。
                送信状況により、到着まで数分程度かかる場合があります。
                <strong className="text-zinc-800">②</strong> は雨天中止の確定と、参加者への即時メール送信をセットで行う経路です。
                誤送信を防ぐため、下のチェックをオンにしないと「登録する」を押せません。
              </p>
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
                  <span className="font-semibold text-zinc-900">① 前日・自動で一斉送信（16:30頃）</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">
                    開催前日の定時処理（目安16:30開始）で送信。ここで登録しただけではまだ送りません。
                  </span>
                </span>
              </label>
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
                  <span className="font-semibold text-zinc-900">② 今すぐメールで通知</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">
                    雨天中止の確定と即時メールをまとめて行う経路です。下のチェックをオンにしたうえで「登録する」を押してください。
                  </span>
                </span>
              </label>
              {cancelDelivery === "immediate" ? (
                <label className="ml-0 flex min-h-10 items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 sm:ml-6">
                  <input
                    type="checkbox"
                    checked={immediate}
                    onChange={(ev) => setImmediate(ev.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    登録と同時に「雨天中止のお知らせ」をメール送信する（必須・オンのときだけ「登録する」が押せます）
                  </span>
                </label>
              ) : null}
            </fieldset>
          ) : null}

          <button
            type="submit"
            disabled={
              loading ||
              !decision ||
              (decision === "cancel" &&
                cancelDelivery === "immediate" &&
                !immediate)
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-50 sm:min-h-10 sm:w-auto"
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
