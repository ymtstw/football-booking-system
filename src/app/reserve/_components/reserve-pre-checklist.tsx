"use client";

import { useCallback, useId, useState } from "react";

import { RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA } from "@/lib/copy/reserve-public-mail-schedule";
import { IconClipboard } from "./reserve-icons";
import { ReserveCallout, ReserveHeadingWithIcon } from "./ui";

/** 画面2: 確認事項の全文 */
const DETAIL_ITEMS: string[] = [
  "本イベントは午前から午後までの1日利用です。",
  "開催日の2日前15:00時点で3チーム以上の予約がある場合に開催します。",
  "開催時は午前1試合・午後1試合を確約し、参加チーム数に応じて試合数が増える場合があります。",
  "昼食代はチームごとに代表者がまとめて当日現地でお支払いください。",
  `Web 上での予約内容の変更・取消は、${RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}までに「予約の確認・キャンセル」からお手続きください。`,
  "当日の進行や対戦順等は、参加チーム同士でご相談のうえ、必要に応じて調整してください。",
  "無断キャンセルおよび締切後のキャンセルはご遠慮ください。",
];

const LEAD = "予約へ進む前に、内容をご確認ください。";

function DetailList({ id }: { id?: string }) {
  return (
    <ul
      id={id}
      className="mt-3 list-disc space-y-1.5 rounded-xl border border-green-200 bg-white/80 px-4 py-3 pl-9 pr-3 text-sm leading-relaxed text-slate-800 marker:text-green-600 sm:mt-4 sm:text-base sm:leading-7"
    >
      {DETAIL_ITEMS.map((text, i) => (
        <li key={i}>{text}</li>
      ))}
    </ul>
  );
}

export function ReservePreCheckAgreement({
  checked,
  onToggle,
  layout,
  sectionId,
  checkboxId,
}: {
  checked: boolean;
  onToggle: (value: boolean) => void;
  /** PC: 確認事項を常に表示。スマホ: 開閉ボタン＋同意の段階制御 */
  layout: "desktop" | "mobile";
  sectionId?: string;
  checkboxId?: string;
}) {
  const isDesktop = layout === "desktop";
  const listRegionId = useId();
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  /** スマホ: 確認事項を開いたあと（または未開封のまま同意チェックを試したあと）に同意可 */
  const [mobileAgreementUnlocked, setMobileAgreementUnlocked] = useState(false);

  const detailsVisible = isDesktop || mobileDetailsOpen;

  const toggleMobileDetails = useCallback(() => {
    setMobileDetailsOpen((wasOpen) => {
      if (!wasOpen) setMobileAgreementUnlocked(true);
      return !wasOpen;
    });
  }, []);

  const handleCheckboxChange = (next: boolean) => {
    onToggle(next);
  };

  const agreeDisabled = !isDesktop && !mobileAgreementUnlocked;

  const checkboxRow = (
    <div>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 border-green-300 bg-white p-3 text-sm font-bold text-slate-800 transition-colors sm:p-4 sm:text-base ${
          agreeDisabled ? "cursor-pointer hover:bg-green-50/60" : "hover:bg-green-50"
        }`}
        onClickCapture={(e) => {
          if (agreeDisabled) {
            e.preventDefault();
            setMobileDetailsOpen(true);
            setMobileAgreementUnlocked(true);
          }
        }}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          disabled={agreeDisabled}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-green-600 focus:ring-green-600 disabled:cursor-pointer disabled:opacity-60"
          aria-describedby={agreeDisabled ? `${listRegionId}-agree-hint` : undefined}
        />
        <span>内容を確認し、同意します</span>
      </label>
      {agreeDisabled ? (
        <p id={`${listRegionId}-agree-hint`} className="mt-1.5 text-[11px] leading-snug text-slate-500">
          ※ 先に確認事項を開いてください
        </p>
      ) : null}
    </div>
  );

  return (
    <ReserveCallout
      id={sectionId}
      tone="green"
      className="scroll-mt-4 p-5 shadow-sm sm:p-6 sm:scroll-mt-6"
    >
      <ReserveHeadingWithIcon
        as="h2"
        shell="green"
        icon={<IconClipboard className="h-6 w-6" />}
        textClassName="text-xl font-bold text-green-800 sm:text-2xl"
      >
        ご予約前の確認事項
      </ReserveHeadingWithIcon>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">{LEAD}</p>

      {!isDesktop ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-green-600 bg-white px-4 text-sm font-bold text-green-800 shadow-sm transition-colors hover:bg-green-50"
          onClick={toggleMobileDetails}
          aria-expanded={mobileDetailsOpen}
          aria-controls={mobileDetailsOpen ? listRegionId : undefined}
        >
          {mobileDetailsOpen ? "確認事項を閉じる" : "確認する"}
        </button>
      ) : null}

      {detailsVisible ? <DetailList id={isDesktop ? undefined : listRegionId} /> : null}

      <div className="mt-4">{checkboxRow}</div>
    </ReserveCallout>
  );
}

export function allPreChecksOk(checked: boolean): boolean {
  return checked;
}
