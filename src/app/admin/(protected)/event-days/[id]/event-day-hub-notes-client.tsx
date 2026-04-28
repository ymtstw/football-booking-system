"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  eventDayId: string;
  /** 初期表示用（保存後は画面再取得で同期） */
  initialNotes: string | null;
};

export function EventDayHubNotesClient({ eventDayId, initialNotes }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialNotes?.trim() ? initialNotes : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setText(initialNotes?.trim() ? initialNotes : "");
  }, [initialNotes]);

  const dirty = text.trim() !== (initialNotes?.trim() ?? "");

  const save = useCallback(async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-days/${encodeURIComponent(eventDayId)}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text.trim() === "" ? null : text.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setMessage({
          tone: "err",
          text: typeof data.error === "string" && data.error ? data.error : "保存に失敗しました",
        });
        return;
      }
      setMessage({ tone: "ok", text: "保存しました" });
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "通信に失敗しました" });
    } finally {
      setSaving(false);
    }
  }, [eventDayId, text, router]);

  return (
    <div className="mt-3 space-y-3">
      <label htmlFor="hub-event-day-notes" className="sr-only">
        当日の共有メモ入力
      </label>
      <textarea
        id="hub-event-day-notes"
        name="notes"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage(null);
        }}
        disabled={saving}
        placeholder="当日の申し送り・注意事項を入力"
        className="min-h-23 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:min-h-28 sm:text-sm"
      />
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => void save()}
        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border-2 border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 sm:w-auto"
      >
        {saving ? "保存中…" : "メモを保存"}
      </button>
      <div className="space-y-1 text-xs leading-relaxed text-zinc-500">
        <p>ここに入力した内容は、この開催日の管理画面で共有されます。参加チームには表示されません。</p>
      </div>
      {message ? (
        <p
          role="status"
          className={
            message.tone === "ok"
              ? "text-xs font-medium text-emerald-800"
              : "text-xs font-medium text-red-800"
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
