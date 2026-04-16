"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 運営都合中止を取り消す（API は open/locked 中止のみ可） */
export function OperationalRestoreButton({ eventDayId }: { eventDayId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRestore() {
    const ok = window.confirm(
      "運営都合による中止を取り消し、中止前の状態に戻します。よろしいですか？"
    );
    if (!ok) return;
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event-days/${eventDayId}/operational-restore`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? `エラー（${res.status}）`);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleRestore()}
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-400 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading ? <InlineSpinner /> : null}
        {loading ? "処理中…" : "運営中止を取り消す"}
      </button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
