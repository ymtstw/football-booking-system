"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";

type Props = {
  anchorEventDate: string;
  explicitAround: boolean;
};

/** 直近の開催: 一覧と同じ「基準日」で最初のカードを切り替え（1 行） */
export function DashboardAroundBar({ anchorEventDate, explicitAround }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(anchorEventDate);

  useEffect(() => {
    setDraft(anchorEventDate);
  }, [anchorEventDate]);

  function apply() {
    if (!draft) return;
    startTransition(() => {
      router.push(`/admin/dashboard?around=${encodeURIComponent(draft)}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-100 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
      <span className="shrink-0 text-sm font-medium text-zinc-700">基準日（東京）</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <DateInputWithPicker
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 sm:max-w-[11rem]"
          aria-label="基準日を選ぶ"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={isPending}
          aria-busy={isPending || undefined}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <InlineSpinner variant="onDark" /> : null}
          表示
        </button>
        {explicitAround ? (
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-emerald-800 underline decoration-emerald-600/50 underline-offset-2 hover:text-emerald-950"
          >
            今日に戻す
          </Link>
        ) : null}
      </div>
      <p className="w-full text-xs leading-snug text-zinc-500 sm:w-auto sm:pl-1">
        現在: <span className="font-medium text-zinc-700">{formatIsoDateWithWeekdayJa(anchorEventDate)}</span>
      </p>
    </div>
  );
}
