"use client";

import { IconClipboard } from "./reserve-icons";
import { ReserveCallout, ReserveHeadingWithIcon } from "./ui";

/** 画面2: ご予約前の確認事項（まとめて1チェック同意） */
const ITEMS: string[] = [
  "本イベントは午前から午後までの1日利用です。",
  "開催日の2日前15:00時点で3チーム以上の予約がある場合に開催します。",
  "開催時は午前1試合・午後1試合を確約し、参加チーム数に応じて試合数が増える場合があります。",
  "昼食代はチームごとに代表者がまとめて当日現地でお支払いください。",
  "締切前のみ、Web上で予約内容の変更・取消ができます。",
  "当日の進行や対戦順等は、参加チーム同士でご相談のうえ、必要に応じて調整してください。",
  "無断キャンセルおよび締切後のキャンセルはご遠慮ください。",
];

export function ReservePreChecklist({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <ReserveCallout tone="green" className="p-5 shadow-sm sm:p-6">
      <ReserveHeadingWithIcon
        as="h2"
        shell="green"
        icon={<IconClipboard className="h-6 w-6" />}
        textClassName="text-xl font-bold text-green-800 sm:text-2xl"
      >
        ご予約前の確認事項
      </ReserveHeadingWithIcon>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
        以下の内容をご確認のうえ、同意してから開催日・午前枠の選択に進んでください。
      </p>

      <ul className="mt-4 list-disc space-y-1.5 rounded-xl border border-green-200 bg-white/70 py-4 pl-9 pr-4 text-sm leading-relaxed text-slate-800 marker:text-green-600 sm:text-base sm:leading-7">
        {ITEMS.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-green-300 bg-white p-4 text-sm font-bold text-slate-800 transition-colors hover:bg-green-50 sm:text-base">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-green-600 focus:ring-green-600"
        />
        <span>上記の内容を確認し、同意します。</span>
      </label>
    </ReserveCallout>
  );
}

export function allPreChecksOk(checked: boolean): boolean {
  return checked;
}
