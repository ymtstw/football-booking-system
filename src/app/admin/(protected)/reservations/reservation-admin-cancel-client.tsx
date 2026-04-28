"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";

type Props = {
  reservationId: string;
  reservationActive: boolean;
  /** 親カード側で枠・見出しがあるとき */
  embedded?: boolean;
};

/** 予約取消（公開取消と同一 RPC・同一ルール） */
export function ReservationAdminCancelClient({
  reservationId,
  reservationActive,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    const ok = window.confirm(
      "この予約をキャンセルします。よろしいですか？（取り消しできない場合があります）"
    );
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${reservationId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "キャンセルに失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const body = (
    <>
      {!embedded ? (
        <h2 className="text-sm font-semibold text-zinc-900">予約のキャンセル</h2>
      ) : null}
      <div
        className={`space-y-2 text-xs leading-snug text-zinc-700 sm:text-sm ${embedded ? "" : "mt-2"}`}
      >
        <p>この予約をキャンセルします。</p>
        <p className="text-zinc-600">
          キャンセルすると、予約一覧から有効な予約として扱われなくなります。
        </p>
        <p className="text-zinc-600">
          試合表を作成済みの場合は、必要に応じて試合表も確認してください。
        </p>
      </div>
      {!reservationActive ? (
        <p className="mt-3 text-sm text-zinc-600">すでにキャンセル済みです。</p>
      ) : (
        <>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleCancel()}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-900 hover:bg-red-100 sm:w-auto sm:min-w-[12rem]"
          >
            {loading ? (
              <>
                <InlineSpinner variant="onLight" className="mr-2" />
                処理中…
              </>
            ) : (
              "予約をキャンセルする"
            )}
          </button>
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      {body}
    </section>
  );
}
