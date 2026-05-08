"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { MAIL_BODY_SERVICE_NAME } from "@/lib/email/mail-brand";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type OperationalCancelEventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
};

export function OperationalCancelForm({
  eventDay,
}: {
  eventDay: OperationalCancelEventDayRow;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  /** ① 前日バッチ／② 即時（天候対応フォームと同様の区分） */
  const [operationalDelivery, setOperationalDelivery] = useState<
    "day_before_17" | "immediate"
  >("day_before_17");
  const [immediateSendConfirmed, setImmediateSendConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = notice.trim();
    if (!trimmed) {
      setMessage("参加チーム向けのお知らせ文は必須です。案内文を記載ください");
      return;
    }
    const sendImmediate =
      operationalDelivery === "immediate" && immediateSendConfirmed;
    const ok = window.confirm(
      "運営都合による開催中止として登録します。\n" +
        (sendImmediate
          ? "② のとおり、登録と同時に「運営都合により開催中止」の即時メールを送ります。\n"
          : "① のとおり、この画面ではまだ送信せず、開催前日の定時バッチ（目安16:30開始）にこの文面が載ります。\n") +
        "\n実行してよいですか？"
    );
    if (!ok) return;

    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event-days/${eventDay.id}/operational-cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantNotice: trimmed,
          sendImmediateOperationalNotice: sendImmediate,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        immediateNotice?: { sent: number; skipped: number };
      };
      if (!res.ok) {
        setMessage(json.error ?? "送信に失敗しました。再試行するか、しばらくしてからお試しください。");
        return;
      }
      const im = json.immediateNotice;
      const qs = new URLSearchParams({ operationalRegistered: "1" });
      if (im) {
        qs.set("imSent", String(im.sent));
        qs.set("imSkip", String(im.skipped));
      }
      router.push(`/admin/event-days/${eventDay.id}/slots?${qs.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  const batchPreviewSample = [
    `（お届け先のお名前） 様`,
    "",
    `${MAIL_BODY_SERVICE_NAME}について、明日のご案内です。`,
    "",
    "明日の開催は中止といたします。",
    "",
    "チーム名: （予約のチーム名）",
    "開催日: （開催日・曜日）",
    gradeBandLinePreview(eventDay.grade_band),
    "【中止理由・ご連絡事項】",
    "← この見出しの直下に、下の「参加者向けのお知らせ文」に入力した全文がそのまま入ります（送信実装と同じ位置です）。",
    "",
    "こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
    "ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。",
  ].join("\n");

  const immediatePreviewSample = [
    `（お届け先のお名前） 様`,
    "",
    "運営上の都合により、下記の開催日は中止となります。",
    "",
    "・チーム名：（予約データのチーム名）",
    `・開催日：${formatIsoDateWithWeekdayJa(eventDay.event_date)}`,
    `・学年帯：${eventDay.grade_band.trim() || "（学年帯）"}`,
    "",
    "【お知らせ】",
    "← 下の「参加者向けのお知らせ文」に入力した全文（即時メールの差し込みと同じ）",
    "",
    "【中止理由・ご連絡事項】",
    "← 同じお知らせ文がそのまま入ります（即時メールの差し込みと同じ）",
  ].join("\n");

  return (
    <form
      onSubmit={(ev) => void handleSubmit(ev)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800">
          {formatIsoDateWithWeekdayJa(eventDay.event_date)}（{eventDay.grade_band}）
        </p>
        <p className="mt-1 text-xs text-zinc-500">状態: {eventDay.status}</p>
      </div>

      <div>
        <label htmlFor="op-notice" className="block text-sm font-medium text-zinc-800">
          参加者向けのお知らせ文（必須）
        </label>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 sm:text-sm">
          <strong className="font-semibold text-zinc-900">
            参加チーム向けのお知らせ文は必須です。
          </strong>
          電話・振替の期限など、ご家庭が次に取れる行動が分かるように書いてください。
        </p>
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-xs leading-relaxed text-rose-950 sm:text-sm">
          <p className="font-semibold text-rose-900">
            {operationalDelivery === "day_before_17"
              ? "① で送るメール（前日・一括）の差し込み位置"
              : "② で送るメール（即時）の差し込み位置"}
          </p>
          <p className="mt-1 whitespace-pre-wrap wrap-break-word text-zinc-800">
            {operationalDelivery === "day_before_17" ? batchPreviewSample : immediatePreviewSample}
          </p>
        </div>
        <textarea
          id="op-notice"
          value={notice}
          onChange={(ev) => setNotice(ev.target.value)}
          rows={8}
          required
          aria-required
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:min-h-10 sm:text-sm"
          placeholder="例: 施設都合により当該日の開催を中止します。別日の振替は〇〇までにメールでご連絡します。"
        />
      </div>

      <fieldset className="space-y-3 rounded-md border border-rose-200/90 bg-rose-50/50 p-3">
        <legend className="text-sm font-medium text-zinc-800">
          運営中止の連絡（どちらか一方）
        </legend>
        <p className="text-xs leading-relaxed text-zinc-600">
          <strong className="text-zinc-800">①</strong>
          はこの画面では送らず、
          <strong className="text-zinc-800">開催前日に自動で一斉送信</strong>
          されます（届くのは目安
          <strong className="text-zinc-800"> 16:30頃</strong>）。
          送信状況により、到着まで数分程度かかる場合があります。
          <strong className="text-zinc-800">②</strong>
          は運営中止の確定と、参加者への即時メール送信をセットで行う経路です。
          誤送信を防ぐため、下のチェックをオンにしないと「緊急中止として登録する」を押せません。
        </p>
        <label className="flex min-h-10 items-start gap-2 text-sm text-zinc-800">
          <input
            type="radio"
            name="operationalDelivery"
            checked={operationalDelivery === "day_before_17"}
            onChange={() => {
              setOperationalDelivery("day_before_17");
              setImmediateSendConfirmed(false);
            }}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-zinc-900">
              ① 前日・自動で一斉送信（16:30頃）
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">
              開催前日の定時処理（目安16:30開始）で送信。ここで登録しただけではまだ送りません。
            </span>
          </span>
        </label>
        <label className="flex min-h-10 items-start gap-2 text-sm text-zinc-800">
          <input
            type="radio"
            name="operationalDelivery"
            checked={operationalDelivery === "immediate"}
            onChange={() => setOperationalDelivery("immediate")}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-zinc-900">② 今すぐメールで通知</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">
              運営中止の確定と即時メールをまとめて行う経路です。下のチェックをオンにしたうえで登録してください。
            </span>
          </span>
        </label>
        {operationalDelivery === "immediate" ? (
          <label className="ml-0 flex min-h-10 items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 sm:ml-6">
            <input
              type="checkbox"
              checked={immediateSendConfirmed}
              onChange={(ev) => setImmediateSendConfirmed(ev.target.checked)}
              className="mt-1"
            />
            <span>
              登録と同時に「運営都合により開催中止」のメールを送信する（必須・オンのときだけ登録できます）
            </span>
          </label>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={
          loading ||
          !notice.trim() ||
          (operationalDelivery === "immediate" && !immediateSendConfirmed)
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-50 sm:w-auto"
      >
        {loading ? <InlineSpinner variant="onDark" /> : null}
        {loading ? "送信中…" : "緊急中止として登録する"}
      </button>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </form>
  );
}

function gradeBandLinePreview(gradeBand: string): string {
  const g = gradeBand?.trim();
  return g ? `学年帯: ${g}` : "学年帯: （学年帯）";
}
