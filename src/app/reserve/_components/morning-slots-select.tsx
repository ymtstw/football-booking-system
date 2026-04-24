"use client";

import { getDefaultSlotDisplayIntervalsForPhase } from "@/domains/event-days/default-slots";
import {
  gradeYearLabelJa,
} from "@/lib/reservations/grade-year";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";


export type MorningSlotSelectRow = {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  activeCount: number;
  full: boolean;
  bookable: boolean;
  isLocked: boolean;
  bookedTeams?: Array<{
    reservationId: string;
    teamName: string;
    strengthCategory: string;
    representativeGradeYear?: number | null;
  }>;
};

function formatHm(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** 枠リスト直上のチームカテゴリ説明の出し方 */
export type MorningSlotCategoryLegendMode = "none" | "full" | "compact";

/** 午前枠の単一選択 UI（開催日選択・予約入力で共用）。同じ枠を再度タップで選択解除。readOnly で閲覧のみ */
export function MorningSlotsSelect({
  morningSlots,
  acceptingReservations,
  eventDayStatus,
  selectedSlotId,
  onSelectSlot,
  subheading = "チームごとにどれか1枠を選択してください",
  /** 未指定時は「午前の対戦枠（…）」。開催日選択では「午前の希望時間を選ぶ」など */
  sectionHeading,
  variant = "full",
  /** full: 箇条書き。compact: 枠上に1段落。none: 非表示 */
  categoryLegendMode = "full",
  readOnly = false,
  /** 午前枠リストの直下に、午後の例示時刻のみ小さく表示（選択・予約不可・1日の目安） */
  showAfternoonScheduleHint = false,
}: {
  morningSlots: MorningSlotSelectRow[];
  acceptingReservations: boolean;
  eventDayStatus?: string;
  selectedSlotId: string;
  /** 枠 ID を渡すと選択。空文字を渡すと選択解除 */
  onSelectSlot: (id: string) => void;
  subheading?: string;
  sectionHeading?: string;
  /** compact: モックの「1: 5年 ハイレベル」形式。full: チーム名付き */
  variant?: "compact" | "full";
  categoryLegendMode?: MorningSlotCategoryLegendMode;
  /** true のときラジオなし（開催確認・試合予定の閲覧専用） */
  readOnly?: boolean;
  showAfternoonScheduleHint?: boolean;
}) {
  const cancelled =
    eventDayStatus === "cancelled_weather" ||
    eventDayStatus === "cancelled_operational" ||
    eventDayStatus === "cancelled_minimum";

  const dense = variant === "compact";
  const afternoonIntervals = showAfternoonScheduleHint
    ? getDefaultSlotDisplayIntervalsForPhase("afternoon")
    : [];

  return (
    <section
      className={
        dense
          ? "min-w-0 rounded-2xl border border-green-200 bg-white p-3 shadow-sm sm:p-3.5"
          : "min-w-0 rounded-[20px] border border-green-200 bg-white p-4 shadow-sm sm:p-5"
      }
    >
      <h2
        id="morning-slots-heading"
        className={
          dense
            ? "text-base font-bold text-green-800 sm:text-lg"
            : "text-lg font-bold text-green-800 sm:text-xl"
        }
      >
        {sectionHeading ??
          (readOnly ? "午前の対戦枠（状況）" : "午前の対戦枠（選択可）")}
      </h2>
      <p
        className={
          dense
            ? "mt-0.5 whitespace-pre-line text-xs leading-snug text-slate-600"
            : "mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600"
        }
      >
        {subheading}
      </p>
      {categoryLegendMode === "full" ? (
        <ul className="mt-2 space-y-1 text-xs leading-snug text-slate-600 sm:text-sm">
          <li>
            <span className="font-semibold text-green-700">ハイレベル</span>
            ：経験が多く試合に慣れているチーム
          </li>
          <li>
            <span className="font-semibold text-green-700">ポテンシャル</span>
            ：これから成長していくチーム
          </li>
        </ul>
      ) : categoryLegendMode === "compact" ? (
        <div
          className={
            dense
              ? "mt-2 space-y-0.5 rounded-md border border-green-100 bg-green-50/60 px-2 py-1.5 text-[11px] leading-snug text-slate-700 sm:text-xs"
              : "mt-2 space-y-1 rounded-md border border-green-100 bg-green-50/50 px-3 py-2 text-xs leading-relaxed text-slate-700"
          }
        >
          <p>
            <span className="font-semibold text-green-800">ハイレベル</span>
            ＝試合に慣れたチーム
          </p>
          <p>
            <span className="font-semibold text-green-800">ポテンシャル</span>
            ＝これから伸びていくチーム
          </p>
        </div>
      ) : null}
      {readOnly && acceptingReservations ? (
        <p className="mt-3 text-sm text-slate-600">
          閲覧のみです。枠の選択・予約は「予約する」からお進みください。
        </p>
      ) : null}
      {!acceptingReservations && (
        <p
          className={`mt-3 text-sm ${
            readOnly && !cancelled ? "text-slate-600" : "text-red-700"
          }`}
        >
          {readOnly && !cancelled ? (
            <>
              閲覧のみです。新規予約・変更は「予約する」「予約の確認・キャンセル」からお手続きください。
            </>
          ) : eventDayStatus === "cancelled_weather" ? (
            "雨天のため開催中止です。新規の予約はできません。"
          ) : eventDayStatus === "cancelled_operational" ? (
            "運営の都合により開催中止です。新規の予約はできません。"
          ) : eventDayStatus === "cancelled_minimum" ? (
            "最少催行に満たないため開催中止です。新規の予約はできません。"
          ) : eventDayStatus === "confirmed" ? (
            "編成が確定済みのため、新規の予約はできません。"
          ) : eventDayStatus === "locked" ? (
            "締切後のため、新規の予約はできません。"
          ) : (
            "予約締切を過ぎているため、新規の予約はできません。"
          )}
        </p>
      )}
      <ul
        className={dense ? "mt-2 space-y-2" : "mt-4 space-y-3"}
        role={readOnly ? undefined : "radiogroup"}
        aria-labelledby="morning-slots-heading"
      >
        {morningSlots.map((s) => {
          const disabled = !readOnly && (!s.bookable || !acceptingReservations);
          const isFull = s.full;
          const teams = s.bookedTeams ?? [];
          const remain = Math.max(0, s.capacity - s.activeCount);
          const slotHeadline = s.full
            ? `${formatHm(s.startTime)}–${formatHm(s.endTime)}（満席）`
            : `${formatHm(s.startTime)}–${formatHm(s.endTime)}（残り${remain}枠）`;
          const selected = selectedSlotId === s.id;
          const boxClass = readOnly
            ? dense
              ? "flex min-h-11 items-start gap-2.5 rounded-xl border-2 border-slate-200 bg-white p-3"
              : "flex min-h-12 items-start gap-3 rounded-[16px] border-2 border-slate-200 bg-white p-3.5 sm:p-4"
            : dense
              ? `flex w-full min-h-11 items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-colors ${
                  disabled
                    ? isFull
                      ? "cursor-not-allowed border-slate-300 bg-slate-300/90 text-slate-700"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    : "cursor-pointer " +
                      (selected
                        ? "border-green-600 bg-green-50 shadow-sm ring-2 ring-green-600/20"
                        : "border-slate-200 bg-white hover:border-green-200")
                }`
              : `flex w-full min-h-12 items-start gap-3 rounded-[16px] border-2 p-3.5 text-left transition-colors sm:p-4 ${
                  disabled
                    ? isFull
                      ? "cursor-not-allowed border-slate-300 bg-slate-300/90 text-slate-700"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    : "cursor-pointer " +
                      (selected
                        ? "border-green-600 bg-green-50 shadow-sm ring-2 ring-green-600/20"
                        : "border-slate-200 bg-white hover:border-green-200")
                }`;
          const radioDot = (
            <span
              className={`${dense ? "mt-0.5 sm:mt-1" : "mt-1 sm:mt-1.5"} flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                disabled && isFull
                  ? "border-slate-600 bg-zinc-900"
                  : selected && !disabled
                    ? "border-green-600 bg-white"
                    : "border-slate-300 bg-white"
              }`}
              aria-hidden
            >
              {selected && !disabled ? (
                <span className="h-2 w-2 rounded-full bg-green-600" />
              ) : null}
            </span>
          );
          const body = (
            <div
              className={
                dense
                  ? "min-w-0 flex-1 space-y-1 text-xs sm:text-sm"
                  : "min-w-0 flex-1 space-y-2 text-sm"
              }
            >
              <div
                className={`font-semibold ${readOnly ? "text-slate-900" : disabled ? "text-slate-700" : "text-slate-900"}`}
              >
                {slotHeadline}
                {s.isLocked ? (
                  <span className="ml-1 text-xs font-normal text-amber-800">・ロック中</span>
                ) : null}
              </div>
              <div>
                <p
                  className={
                    dense
                      ? "text-[10px] font-medium text-slate-500 sm:text-xs"
                      : "text-xs font-medium text-slate-500"
                  }
                >
                  予約済みチーム
                </p>
                {teams.length === 0 ? (
                  <p
                    className={
                      dense
                        ? "mt-0.5 text-[11px] text-slate-500 sm:text-xs"
                        : "mt-1 text-slate-500"
                    }
                  >
                    なし
                  </p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-800">
                    {teams.map((t, idx) => {
                      const gy = t.representativeGradeYear;
                      if (variant === "compact") {
                        const gradePart =
                          typeof gy === "number" && gy >= 1 && gy <= 6
                            ? `${idx + 1}：${gradeYearLabelJa(gy)} `
                            : `${idx + 1}：`;
                        return (
                          <li key={t.reservationId}>
                            {gradePart}
                            {strengthCategoryLabelJa(t.strengthCategory)}
                          </li>
                        );
                      }
                      const gradePart =
                        typeof gy === "number" && gy >= 1 && gy <= 6
                          ? `${gradeYearLabelJa(gy)}・`
                          : "";
                      return (
                        <li key={t.reservationId}>
                          {t.teamName}: {gradePart}
                          {strengthCategoryLabelJa(t.strengthCategory)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );

          return (
            <li key={s.id}>
              {!readOnly ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  className={boxClass}
                  onClick={() => {
                    if (disabled) return;
                    onSelectSlot(selected ? "" : s.id);
                  }}
                >
                  {radioDot}
                  {body}
                </button>
              ) : (
                <div className={boxClass}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {showAfternoonScheduleHint && afternoonIntervals.length > 0 ? (
        <div
          className={
            dense
              ? "mt-2 border-t border-slate-200/90 pt-2"
              : "mt-4 border-t border-slate-200 pt-3"
          }
          aria-label="午後の対戦枠の参考（選択不可）"
        >
          <p
            className={
              dense
                ? "text-[10px] font-semibold leading-tight text-slate-500 sm:text-[11px]"
                : "text-xs font-semibold text-slate-600 sm:text-sm"
            }
          >
            午後の時間（選択・予約不可）
          </p>
          <p
            className={
              dense
                ? "mt-1 flex flex-wrap gap-x-0.5 gap-y-0.5 text-[10px] leading-snug tabular-nums text-slate-600 sm:text-xs sm:leading-normal"
                : "mt-1.5 flex flex-wrap gap-x-1 gap-y-1 text-xs tabular-nums text-slate-700 sm:text-sm"
            }
          >
            {afternoonIntervals.map((slot, i) => (
              <span key={`${slot.start}-${slot.end}`} className="whitespace-nowrap">
                {i > 0 ? (
                  <span className="text-slate-400" aria-hidden>
                    {" · "}
                  </span>
                ) : null}
                {slot.start}–{slot.end}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </section>
  );
}
