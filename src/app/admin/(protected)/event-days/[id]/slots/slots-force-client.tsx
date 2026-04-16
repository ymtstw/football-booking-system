"use client";

import Link from "next/link";
import { useState } from "react";

import { SlotsEditorClient } from "./slots-editor-client";
import type { EventDaySlotEditorRow } from "./slots-editor-client";

/** 予約が残っているときの枠の強制変更（確認チェック後に編集可）。 */
export function SlotsForcePageClient({
  eventDayId,
  initialSlots,
  activeReservationCount,
}: {
  eventDayId: string;
  initialSlots: EventDaySlotEditorRow[];
  activeReservationCount: number;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium text-zinc-500">
        <Link
          href={`/admin/event-days/${eventDayId}/slots`}
          className="text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
        >
          通常の枠・時刻画面へ戻る
        </Link>
      </p>

      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-950 sm:text-sm">
        <p className="font-medium text-rose-950">強制変更モード</p>
        <p className="mt-1">
          この開催日にはアクティブな予約が{" "}
          <strong>{activeReservationCount}</strong>{" "}
          件あります。枠の時刻や「有効」を変えると、確定済みの表示や運用と食い違う可能性があります。
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-relaxed text-zinc-800">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-400"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>
          上記のリスクを理解し、必要最小限の修正のみ行うことに同意します。チェックを入れると編集・保存が有効になります。
        </span>
      </label>

      <SlotsEditorClient
        eventDayId={eventDayId}
        initialSlots={initialSlots}
        editable={acknowledged}
        mutationMode="force"
      />
    </div>
  );
}
