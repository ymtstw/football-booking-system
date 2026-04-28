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
    <div className="mt-3 space-y-2">
      <label htmlFor="hub-event-day-notes" className="sr-only">
        運営メモ
      </label>
      <textarea
        id="hub-event-day-notes"
        name="notes"
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage(null);
        }}
        disabled={saving}
        placeholder="当日の連絡・注意事項など（この開催日の担当者共有用）"
        className="min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:text-sm"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void save()}
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border-2 border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 sm:w-auto"
        >
          {saving ? "保存中…" : "メモを保存"}
        </button>
        <p className="text-[11px] leading-snug text-zinc-500">
          この画面での入力がそのまま保存されます（ほかに入力欄はありません）。
        </p>
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
