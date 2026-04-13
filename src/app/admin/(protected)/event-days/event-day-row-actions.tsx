"use client";

/** 公開前は「公開」「削除」。公開済みは「公開前に戻す」のみ（締切ロックは Cron 等で実施する想定のため手動ボタンは出さない）。 */
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EventDayAdminStatus =
  | "draft"
  | "open"
  | "locked"
  | "confirmed"
  | "cancelled_weather"
  | "cancelled_minimum";

type PendingAction = "idle" | "toOpen" | "toDraft" | "delete";

export function EventDayRowActions({
  id,
  status,
  eventDate,
  layout = "inline",
}: {
  id: string;
  status: EventDayAdminStatus;
  /** ISO YYYY-MM-DD（削除確認文言用） */
  eventDate: string;
  /** stacked: スマホカード向けにボタンを縦並び・幅いっぱい */
  layout?: "inline" | "stacked";
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = pending !== "idle";

  /** draft / open のときだけ操作ボタンを出す（locked 以降は一覧のみ）。 */
  const showPublicActions = status === "draft" || status === "open";

  async function setStatus(next: "draft" | "open") {
    setError(null);
    setPending(next === "open" ? "toOpen" : "toDraft");
    try {
      const res = await fetch(`/api/admin/event-days/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `エラー（${res.status}）`);
        return;
      }
      router.refresh();
    } finally {
      setPending("idle");
    }
  }

  async function deleteDraft() {
    const label = formatIsoDateWithWeekdayJa(eventDate);
    const ok = window.confirm(
      `公開前の開催日「${label}」を削除します。\n` +
        `この開催日に紐づく枠（6枠）などもまとめて削除されます。元に戻せません。\n\n` +
        `本当に削除しますか？`
    );
    if (!ok) return;

    setError(null);
    setPending("delete");
    try {
      const res = await fetch(`/api/admin/event-days/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `エラー（${res.status}）`);
        return;
      }
      router.refresh();
    } finally {
      setPending("idle");
    }
  }

  if (!showPublicActions) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  const rowGap =
    layout === "stacked"
      ? "flex w-full flex-col gap-2"
      : "flex flex-wrap items-center justify-end gap-2";
  const btnBase =
    layout === "stacked"
      ? "min-h-10 w-full rounded-md px-3 py-2.5 text-sm font-medium disabled:cursor-wait disabled:opacity-50"
      : "min-h-9 min-w-[3.25rem] rounded-md px-3 py-2 text-xs font-medium disabled:cursor-wait disabled:opacity-50 sm:text-sm";

  return (
    <div
      className={
        layout === "stacked"
          ? "flex w-full flex-col gap-2"
          : "flex flex-col items-stretch gap-1 sm:items-end"
      }
    >
      <div className={rowGap}>
        {status === "draft" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setStatus("open")}
              title="一般向けの開催日一覧（GET /api/event-days）に載せます"
              className={`${btnBase} inline-flex items-center justify-center gap-2 bg-emerald-700 text-white`}
            >
              {pending === "toOpen" ? <InlineSpinner variant="onDark" /> : null}
              {pending === "toOpen" ? "処理中…" : "公開"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteDraft()}
              title="公開前の開催日を削除（確認ダイアログのあと実行）"
              className={`${btnBase} inline-flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700`}
            >
              {pending === "delete" ? <InlineSpinner variant="onDark" /> : null}
              {pending === "delete" ? "削除中…" : "削除"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setStatus("draft")}
            title="一般公開をやめ、公開前（非公開）に戻します"
            className={`${btnBase} inline-flex items-center justify-center gap-2 border border-zinc-400 bg-white text-zinc-800 hover:bg-zinc-50`}
          >
            {pending === "toDraft" ? <InlineSpinner variant="onLight" /> : null}
            {pending === "toDraft" ? "処理中…" : "公開前に戻す"}
          </button>
        )}
      </div>
      {error ? (
        <span
          className={`block text-xs leading-snug text-red-600 ${
            layout === "stacked"
              ? "w-full text-left"
              : "max-w-56 self-end text-right sm:max-w-xs"
          }`}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
