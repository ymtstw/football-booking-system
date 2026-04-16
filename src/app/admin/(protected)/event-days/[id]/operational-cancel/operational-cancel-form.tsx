"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
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
  const [immediate, setImmediate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = notice.trim();
    if (!trimmed) {
      setMessage("参加者向けのお知らせ文を入力してください");
      return;
    }
    const ok = window.confirm(
      "運営都合による開催中止として登録します。\n" +
        "予約カレンダーでは中止表示になり、前日 17:00 の最終メールにこの文面が反映されます。\n" +
        (immediate
          ? "「即時送信」がオンです。登録と同時に参加者へメールが送られます。\n"
          : "") +
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
          sendImmediateOperationalNotice: immediate,
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

  return (
    <form
      onSubmit={(ev) => void handleSubmit(ev)}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-sm font-medium text-zinc-800">
          {formatIsoDateWithWeekdayJa(eventDay.event_date)}（{eventDay.grade_band}）
        </p>
        <p className="mt-1 text-xs text-zinc-500">状態: {eventDay.status}</p>
      </div>

      <div>
        <label htmlFor="op-notice" className="block text-sm font-medium text-zinc-800">
          参加者向けのお知らせ文（必須）
        </label>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          前日 17:00 の一括メール（JOB03）および、下の即時送信にそのまま載ります。電話番号・集合場所の変更など、ユーザーが取れる行動を書いてください。
        </p>
        <textarea
          id="op-notice"
          value={notice}
          onChange={(ev) => setNotice(ev.target.value)}
          rows={8}
          required
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="例: 施設都合により当該日の開催を中止します。別日の振替は〇〇までにメールでご連絡します。"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={immediate}
          onChange={(ev) => setImmediate(ev.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>例外:</strong> 至急、上記の文面で運営中止のメールを即時送信する（通常は前日 17:00
          の最終版に含めます）
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !notice.trim()}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-rose-700 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? <InlineSpinner variant="onDark" /> : null}
        {loading ? "送信中…" : "緊急中止として登録する"}
      </button>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </form>
  );
}
