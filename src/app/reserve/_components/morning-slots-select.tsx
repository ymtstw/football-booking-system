"use client";

import {
  gradeYearLabelJa,
} from "@/lib/reservations/grade-year";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

import { IconSunMorning } from "./reserve-icons";
import { ReserveHeadingWithIcon } from "./ui/reserve-heading-with-icon";

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

/** 午前枠ラジオ一覧（開催日選択・予約入力で共用） */
export function MorningSlotsSelect({
  morningSlots,
  acceptingReservations,
  eventDayStatus,
  selectedSlotId,
  onSelectSlot,
  subheading = "チームごとにどれか1枠を選択してください",
  variant = "full",
  showCategoryLegend = true,
}: {
  morningSlots: MorningSlotSelectRow[];
  acceptingReservations: boolean;
  eventDayStatus?: string;
  selectedSlotId: string;
  onSelectSlot: (id: string) => void;
  subheading?: string;
  /** compact: モックの「1: 5年 ハイレベル」形式。full: チーム名付き */
  variant?: "compact" | "full";
  showCategoryLegend?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-[20px] border border-green-200 bg-white p-4 shadow-sm sm:p-5">
      <ReserveHeadingWithIcon
        as="h2"
        shell="green"
        icon={<IconSunMorning className="h-5 w-5 sm:h-6 sm:w-6" />}
        textClassName="text-lg font-bold text-green-800 sm:text-xl"
      >
        午前の対戦枠（選択可）
      </ReserveHeadingWithIcon>
      <p className="mt-1 text-sm text-slate-600">{subheading}</p>
      {showCategoryLegend ? (
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
      ) : null}
      {!acceptingReservations && (
        <p className="mt-3 text-sm text-red-700">
          {eventDayStatus === "cancelled_weather"
            ? "雨天のため開催中止です。新規の予約はできません。"
            : eventDayStatus === "cancelled_operational"
              ? "運営の都合により開催中止です。新規の予約はできません。"
              : eventDayStatus === "cancelled_minimum"
                ? "最少催行に満たないため開催中止です。新規の予約はできません。"
                : eventDayStatus === "confirmed"
                  ? "編成が確定済みのため、新規の予約はできません。"
                  : eventDayStatus === "locked"
                    ? "締切後のため、新規の予約はできません。"
                    : "予約締切を過ぎているため、新規の予約はできません。"}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {morningSlots.map((s) => {
          const disabled = !s.bookable || !acceptingReservations;
          const teams = s.bookedTeams ?? [];
          const remain = Math.max(0, s.capacity - s.activeCount);
          const slotHeadline = s.full
            ? `${formatHm(s.startTime)}–${formatHm(s.endTime)}（満席）`
            : `${formatHm(s.startTime)}–${formatHm(s.endTime)}（残り${remain}枠）`;
          return (
            <li key={s.id}>
              <label
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[16px] border-2 p-3.5 transition-colors sm:p-4 ${
                  disabled
                    ? "border-slate-200 bg-slate-100 text-slate-500"
                    : selectedSlotId === s.id
                      ? "border-green-600 bg-green-50 shadow-sm ring-2 ring-green-600/20"
                      : "border-slate-200 bg-white hover:border-green-200"
                }`}
              >
                <input
                  type="radio"
                  name="morning-slot"
                  value={s.id}
                  className="mt-1 h-4 w-4 shrink-0 accent-green-600 sm:mt-1.5"
                  checked={selectedSlotId === s.id}
                  disabled={disabled}
                  onChange={() => onSelectSlot(s.id)}
                />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div className="font-semibold text-slate-900">
                    {slotHeadline}
                    {s.isLocked ? (
                      <span className="ml-1 text-xs font-normal text-amber-800">・ロック中</span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">予約済みチーム</p>
                    {teams.length === 0 ? (
                      <p className="mt-1 text-slate-500">なし</p>
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
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
