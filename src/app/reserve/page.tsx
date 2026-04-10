"use client";

/** SCR-01 入口: 公開中の開催日一覧。 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";

type EventDay = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
};

export default function ReserveEventDaysPage() {
  const [days, setDays] = useState<EventDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/event-days");
      const json = (await res.json().catch(() => ({}))) as {
        eventDays?: EventDay[];
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "一覧の取得に失敗しました");
        setDays([]);
        return;
      }
      setDays(json.eventDays ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">開催日一覧</h1>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-600">
          <p>
            本画面からは午前の1枠（1時間）のみご予約いただけます。
          </p>
          <p>
            午後の試合については、締切後に参加チーム数に応じて自動でマッチング・割り振りが行われます。
          </p>
          <p>
            そのため、ご予約いただいたチームは最低でも午前1試合・午後1試合（各1時間）ご利用いただけます。
          </p>
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        合宿プランなどは
        <span className="text-zinc-500">（別途お知らせの外部サイト）</span>
        をご確認ください。
      </p>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {days === null && !error && (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      )}

      {days && days.length === 0 && !error && (
        <p className="text-sm text-zinc-600">現在、公開中の開催日はありません。</p>
      )}

      {days && days.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {days.map((d) => (
            <li key={d.id}>
              <Link
                href={`/reserve/${d.event_date}`}
                className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-zinc-900">
                  {formatIsoDateWithWeekdayJa(d.event_date)}
                </span>
                <span className="text-sm text-zinc-600">
                  学年帯: {d.grade_band}
                </span>
                <span className="text-sm font-medium text-emerald-700">
                  予約する →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
