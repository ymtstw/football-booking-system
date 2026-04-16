"use client";

/** SCR-01 入口: 公開中の開催日を月カレンダーで選択。 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { initialYearMonthFromEvents } from "@/lib/dates/tokyo-calendar-grid";

import {
  ReserveEventDaysCalendar,
  type EventDayPublic,
} from "./reserve-event-days-calendar";

export default function ReserveEventDaysPage() {
  const [days, setDays] = useState<EventDayPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/event-days");
      const json = (await res.json().catch(() => ({}))) as {
        eventDays?: EventDayPublic[];
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

  const calendarInitialMonth = useMemo(() => {
    if (!days || days.length === 0) return null;
    return initialYearMonthFromEvents(days.map((d) => d.event_date));
  }, [days]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          予約カレンダー
        </h1>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-600">
          <p>
            上の「前の月 / 今月 / 次の月」で表示月を変え、
            <strong className="text-zinc-800">緑の枠</strong>
            の日をタップすると午前枠の予約へ進みます。締切後・編成確定済みはグレー、開催中止は赤系で表示します（いずれも新規予約はできません）。
          </p>
          <p>
            本画面からは午前の1枠（1時間）のみご予約いただけます。午後の試合は締切後に自動でマッチング・割り振りされます。
          </p>
          <p>
            ご予約いただいたチームは最低でも午前1試合・午後1試合（各1時間）ご利用いただけます。
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-600">
        合宿・宿泊のご相談は
        <Link
          href="/reserve/camp"
          className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
        >
          合宿のご案内
        </Link>
        からお送りください（相談受付〜事前案内まで。当日の進行管理は対象外。日帰り予約の確定とは別です）。
      </p>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {days === null && !error && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-zinc-600"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <InlineSpinner size="md" variant="onLight" />
          <p>開催日を読み込み中…</p>
        </div>
      )}

      {days && days.length === 0 && !error && (
        <p className="text-sm text-zinc-600">現在、公開中の開催日はありません。</p>
      )}

      {days && days.length > 0 && calendarInitialMonth && (
        <ReserveEventDaysCalendar
          key={`${calendarInitialMonth.year}-${calendarInitialMonth.month}`}
          days={days}
          initialYearMonth={calendarInitialMonth}
        />
      )}
    </div>
  );
}
