"use client";

/** SCR-02: 予約完了。確認コードは sessionStorage 経由のみ（URL に載せない）。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";

const SESSION_COMPLETE_KEY = "football_reservation_complete_v1";

type Stored = {
  reservationToken: string;
  reservationId: string;
  eventDate?: string;
};

export default function ReserveCompletePage() {
  const router = useRouter();
  const [data, setData] = useState<Stored | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_COMPLETE_KEY);
        if (!raw) {
          setData(null);
          return;
        }
        const parsed = JSON.parse(raw) as Stored;
        if (!parsed.reservationToken || !parsed.reservationId) {
          setData(null);
          return;
        }
        setData(parsed);
      } catch {
        setData(null);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  async function copyConfirmationCode() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.reservationToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function clearAndGoManage() {
    try {
      sessionStorage.removeItem(SESSION_COMPLETE_KEY);
    } catch {
      /* ignore */
    }
    router.push("/reserve/manage");
  }

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">予約完了</h1>
        <p className="text-sm text-zinc-600">
          表示できる予約情報がありません。予約直後の画面のみ表示されます。
        </p>
        <Link href="/reserve" className="text-sm font-medium text-zinc-900 underline">
          開催日一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900">予約が完了しました</h1>

      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-950">
        <p>
          予約時に表示される確認コードは<strong>必ず保存</strong>してください。
          <br />
          （スクリーンショットやコピーがおすすめです）
        </p>
        <p>この確認コードで、予約の確認やキャンセルができます。</p>
        <p>
          第三者に見せたり共有すると、予約の操作ができてしまうため、
          <strong>厳重に保管</strong>してください。
        </p>
      </div>

      {data.eventDate && (
        <p className="text-sm text-zinc-700">
          開催日:{" "}
          <span className="font-medium">
            {formatIsoDateWithWeekdayJa(data.eventDate)}
          </span>
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          確認コード
        </p>
        <p className="mt-2 break-all font-mono text-sm text-zinc-900">
          {data.reservationToken}
        </p>
        <button
          type="button"
          onClick={() => void copyConfirmationCode()}
          className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          {copied ? "コピーしました" : "確認コードをコピー"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        予約 ID（参考）: {data.reservationId}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/reserve"
          className="inline-flex justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
        >
          開催日一覧へ
        </Link>
        <button
          type="button"
          onClick={clearAndGoManage}
          className="inline-flex justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          予約確認・キャンセルページへ
        </button>
      </div>
    </div>
  );
}
