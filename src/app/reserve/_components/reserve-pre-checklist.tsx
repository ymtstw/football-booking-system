"use client";

import { IconClipboard } from "./reserve-icons";
import { ReserveCallout, ReserveHeadingWithIcon } from "./ui";

/** 画面2: ご予約前の確認事項（仕様書 4-9 の文言そのまま） */
const ITEMS: string[] = [
  "本イベントは午前から午後までの1日利用を前提としていることを理解しました。",
  "開催日の2日前15:00時点で3チーム以上の予約がある場合に開催となることを理解しました。",
  "開催時は午前1試合・午後1試合を予定し、対戦相手や試合順は参加状況に応じて決まることを理解しました。",
  "昼食代は各チームの代表者がまとめて当日現地で支払うことを理解しました。",
  "締切前のみ、Web上で予約内容の変更・取り消しができることを理解しました。",
  "当日の運用は、参加チーム同士の合意があれば柔軟に調整できることを理解しました。",
  "無断キャンセルおよび締切後のキャンセルを行わないことを確認しました。",
  "上記を確認しました",
];

export function ReservePreChecklist({
  checked,
  onToggle,
}: {
  checked: boolean[];
  onToggle: (index: number, value: boolean) => void;
}) {
  return (
    <ReserveCallout
      tone="green"
      className="p-5 shadow-sm sm:p-6"
    >
      <ReserveHeadingWithIcon
        as="h2"
        shell="green"
        icon={<IconClipboard className="h-6 w-6 sm:h-6 sm:w-6" />}
        textClassName="text-xl font-bold text-green-800 sm:text-2xl"
      >
        ご予約前の確認事項
      </ReserveHeadingWithIcon>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
        すべてにチェックを入れてから、開催日・午前枠の選択に進んでください。
      </p>
      <ul className="mt-5 space-y-3">
        {ITEMS.map((text, i) => (
          <li key={i}>
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-800 sm:text-base">
              <input
                type="checkbox"
                checked={Boolean(checked[i])}
                onChange={(e) => onToggle(i, e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-green-600 focus:ring-green-600"
              />
              <span>{text}</span>
            </label>
          </li>
        ))}
      </ul>
    </ReserveCallout>
  );
}

export function allPreChecksOk(checked: boolean[]): boolean {
  return checked.length === ITEMS.length && checked.every(Boolean);
}

export const PRE_CHECKLIST_COUNT = ITEMS.length;
