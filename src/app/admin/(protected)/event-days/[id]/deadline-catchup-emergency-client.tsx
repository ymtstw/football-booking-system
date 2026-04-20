"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  eventDayId: string;
};

type ApiOk = { ok: true; outcome: "locked" | "cancelled_minimum" };
type ApiErr = { ok?: false; error?: string; code?: string };

export function DeadlineCatchupEmergencyClient({ eventDayId }: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const run = useCallback(async () => {
    setBanner(null);
    if (!confirmed) return;

    const ok = window.confirm(
      "この開催日について、締め切り後の処理を今からやり直します。\n" +
        "・申し込みチームが 3 未満なら「開催中止（人数不足）」の扱いにし、関係者へお知らせを送ります。\n" +
        "・3 チーム以上なら、予約を締め切り（このあと試合の割り当ての準備段階）にします。\n\n" +
        "実行してよいですか？"
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/event-days/${encodeURIComponent(eventDayId)}/apply-deadline-catchup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });
      const data = (await res.json()) as ApiOk | ApiErr;

      if (!res.ok || !("ok" in data) || data.ok !== true) {
        const msg =
          typeof (data as ApiErr).error === "string" && (data as ApiErr).error
            ? (data as ApiErr).error!
            : "実行に失敗しました";
        setBanner({ tone: "err", text: msg });
        return;
      }

      const label =
        data.outcome === "cancelled_minimum"
          ? "開催中止（人数不足）にしました。お知らせの送信結果は「送信結果を開く」で確認してください。"
          : "予約を締め切りました。続きはいつもどおり自動処理か「試合の手直し」で進めてください。";
      setBanner({ tone: "ok", text: label });
      router.refresh();
    } catch {
      setBanner({ tone: "err", text: "通信に失敗しました。ネットワークを確認してください。" });
    } finally {
      setBusy(false);
    }
  }, [confirmed, eventDayId, router]);

  return (
    <div className="min-w-0 rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 shadow-sm ring-1 ring-amber-100/80">
      <p className="text-sm font-bold text-amber-950">締め切りの取り直し</p>
      <p className="mt-1.5 text-xs leading-relaxed text-amber-950/90">
        毎日の<strong className="font-semibold">自動の締め切り処理</strong>が動いていないときだけ使います。
        <strong className="font-semibold">締切の日時を過ぎているのに、まだ「公開中」のまま</strong>のときに押してください。
      </p>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-amber-950">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy}
        />
        <span>自動処理の不具合など、緊急で使うことに同意する</span>
      </label>
      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={() => void run()}
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-amber-800/30 bg-amber-900 px-3 text-sm font-semibold text-amber-50 shadow-sm hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "実行中…" : "締め切り処理を実行"}
      </button>
      {banner ? (
        <p
          className={
            banner.tone === "ok"
              ? "mt-2 text-xs font-medium text-emerald-900"
              : "mt-2 text-xs font-medium text-red-900"
          }
          role="status"
        >
          {banner.text}
        </p>
      ) : null}
    </div>
  );
}
