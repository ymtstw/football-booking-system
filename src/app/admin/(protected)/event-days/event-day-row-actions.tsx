"use client";

/** 一覧の下書き／公開ボタン。draft/open のときだけ PATCH /api/admin/event-days/[id]。 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type Status =
  | "draft"
  | "open"
  | "locked"
  | "confirmed"
  | "cancelled_weather"
  | "cancelled_minimum";

export function EventDayRowActions({
  id,
  status,
}: {
  id: string;
  status: Status;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canToggle = status === "draft" || status === "open";

  async function setStatus(next: "draft" | "open") {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/event-days/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(false);
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? `エラー（${res.status}）`);
      return;
    }
    router.refresh();
  }

  if (!canToggle) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || status === "draft"}
          onClick={() => void setStatus("draft")}
          className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40"
        >
          下書き
        </button>
        <button
          type="button"
          disabled={loading || status === "open"}
          onClick={() => void setStatus("open")}
          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          公開
        </button>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
