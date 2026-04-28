"use client";

import Link from "next/link";
import { Fragment } from "react";

import { MorningSlotsSelect, type MorningSlotSelectRow } from "../../_components/morning-slots-select";
import { IconArrowLeft } from "../../_components/reserve-icons";
import { ReserveMainShell } from "../../_components/ui";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { publicScheduleHubStatusLabel } from "@/lib/event-days/public-schedule-hub-status";
import { gradeYearLabelJa } from "@/lib/reservations/grade-year";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

type AvailabilityJson = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus?: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  /** 対戦案内メール送信済み（公開側で「試合スケジュール確定」扱い） */
  matchingProposalNoticeSentAt?: string | null;
  /** 有効予約チーム数（枠未選択のチームも含む） */
  activeReservationCount?: number;
  morningSlots: MorningSlotSelectRow[];
  error?: string;
};

type PublicMatch = {
  matchPhase: string;
  assignmentType: string;
  slot: {
    slotCode: string;
    phase: string;
    startTime: string;
    endTime: string;
  } | null;
  sideA: { teamName: string; strengthCategory: string; representativeGradeYear?: number | null };
  sideB: { teamName: string; strengthCategory: string; representativeGradeYear?: number | null };
  referee: { teamName: string; strengthCategory: string; representativeGradeYear?: number | null } | null;
};

type PublicScheduleJson = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  /** 対戦案内メール送信済み（公開側で「試合スケジュール確定」扱い） */
  matchingProposalNoticeSentAt: string | null;
  confirmedMatches: PublicMatch[] | null;
  error?: string;
};

function gradeBandLabelJa(band: string): string {
  const g = band.trim();
  if (g === "1-2") return "1〜2年生";
  if (g === "3-4") return "3〜4年生";
  if (g === "5-6") return "5〜6年生";
  return g;
}

function formatHm(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** 並びが「直前が午前・当行が午後」のとき、間を昼食休憩として表示する */
function shouldShowLunchBreakBetween(matches: PublicMatch[], idx: number): boolean {
  if (idx <= 0) return false;
  const prev = matches[idx - 1]!;
  const curr = matches[idx]!;
  return prev.matchPhase === "morning" && curr.matchPhase === "afternoon";
}

/**
 * 午前最終枠の終了〜午後先頭枠の開始（データ上の時刻）。欠ける場合は null。
 */
function lunchBreakTimeLabel(matches: PublicMatch[], idx: number): string | null {
  if (!shouldShowLunchBreakBetween(matches, idx)) return null;
  const prev = matches[idx - 1]!;
  const curr = matches[idx]!;
  const endM = prev.slot?.endTime?.trim();
  const startA = curr.slot?.startTime?.trim();
  if (!endM || !startA) return null;
  return `${formatHm(endM)}–${formatHm(startA)}`;
}

/** モバイルカード用：学年があれば「1年・カテゴリ」、なければカテゴリのみ */
function gradeCategoryLineJa(side: {
  strengthCategory: string;
  representativeGradeYear?: number | null;
}): string {
  const cat = strengthCategoryLabelJa(side.strengthCategory);
  const gy = side.representativeGradeYear;
  if (typeof gy === "number" && gy >= 1 && gy <= 6) {
    return `${gradeYearLabelJa(gy)}・${cat}`;
  }
  return cat;
}

/** 審判列・審判行：チーム名のみ（学年・カテゴリは付けない） */
function refereeTeamNameOnly(ref: { teamName: string } | null): string {
  if (!ref) return "—";
  const n = ref.teamName.trim();
  return n || "—";
}

export function ScheduleDayClient({
  initialAvailability,
  initialSchedule,
  initialAvailabilityError,
  initialScheduleError,
}: {
  /** サーバーで取得済み（公開 availability JSON と同一形） */
  initialAvailability: AvailabilityJson | null;
  initialSchedule: PublicScheduleJson | null;
  initialAvailabilityError: string | null;
  initialScheduleError: string | null;
}) {
  const avail = initialAvailability;
  const schedule = initialSchedule;
  const availError =
    initialAvailabilityError === null || initialAvailabilityError === ""
      ? null
      : initialAvailabilityError;
  const scheduleError =
    initialScheduleError === null || initialScheduleError === ""
      ? null
      : initialScheduleError;

  if (availError && !avail) {
    return (
      <div className="space-y-4">
        <Link
          href="/reserve/schedule"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-rp-brand underline"
        >
          <IconArrowLeft className="h-4 w-4" strokeWidth={2} />
          開催確認・試合予定一覧へ
        </Link>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {availError}
        </p>
      </div>
    );
  }

  if (!avail) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        読み込み中…
      </p>
    );
  }

  const matches = schedule?.confirmedMatches;
  const isAfterDeadline = !avail.acceptingReservations;
  const schedulePublished = Boolean(schedule?.matchingProposalNoticeSentAt);
  const hasMatches = Array.isArray(matches) && matches.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link
        href="/reserve/schedule"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-rp-brand underline"
      >
        <IconArrowLeft className="h-4 w-4" strokeWidth={2} />
        開催確認・試合予定一覧へ
      </Link>

      <ReserveMainShell className="p-3 sm:p-4 md:p-5">
        <div className="space-y-1.5 text-slate-900">
          <h1 className="text-xl font-extrabold leading-snug sm:text-2xl">
            {formatIsoDateWithWeekdayJa(avail.eventDate)}　{gradeBandLabelJa(avail.gradeBand)}
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            {
              publicScheduleHubStatusLabel({
                status: String(avail.eventDayStatus ?? ""),
                acceptingReservations: avail.acceptingReservations,
                matchingProposalNoticeSentAt: avail.matchingProposalNoticeSentAt ?? null,
              }).label
            }{" "}
            / 参加チーム：
            {typeof avail.activeReservationCount === "number" ? avail.activeReservationCount : 0}チーム
          </p>
        </div>
      </ReserveMainShell>

      {schedulePublished ? (
        <>
          <section className="rounded-[20px] border border-rp-mint-2 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-rp-navy sm:text-xl">試合スケジュール</h2>
            {scheduleError ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {scheduleError}
              </p>
            ) : !hasMatches ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                試合データがまだ登録されていないか、取得できませんでした。しばらくしてから再度お試しください。
              </p>
            ) : (
              <>

            <div className="mt-4 space-y-4 sm:hidden">
              {matches!.map((m, idx) => {
                const sl = m.slot;
                const timeHead = sl
                  ? `${formatHm(sl.startTime)}–${formatHm(sl.endTime)}`
                  : "—";
                const lunchBreak = shouldShowLunchBreakBetween(matches!, idx);
                const lunchTime = lunchBreakTimeLabel(matches!, idx);
                const lineA = gradeCategoryLineJa(m.sideA);
                const lineB = gradeCategoryLineJa(m.sideB);
                const nameA = m.sideA.teamName.trim() || "—";
                const nameB = m.sideB.teamName.trim() || "—";
                return (
                  <Fragment
                    key={`${m.matchPhase}-${m.slot?.slotCode ?? "s"}-${m.sideA.teamName}-${m.sideB.teamName}-${idx}`}
                  >
                    {lunchBreak ? (
                      <div
                        className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-center text-sm text-slate-800 shadow-sm"
                        role="note"
                      >
                        {lunchTime ? (
                          <span className="font-semibold tabular-nums">{lunchTime}</span>
                        ) : null}
                        <span className={lunchTime ? "ml-2 font-medium" : "font-medium"}>
                          昼食休憩
                        </span>
                      </div>
                    ) : null}
                  <div
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-900"
                  >
                    <p className="font-semibold tabular-nums leading-snug text-slate-800">{timeHead}</p>
                    <div className="mt-3 grid gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">チームA</p>
                        <p className="mt-0.5 text-base font-semibold leading-snug wrap-break-word">{nameA}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{lineA}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">チームB</p>
                        <p className="mt-0.5 text-base font-semibold leading-snug wrap-break-word">{nameB}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{lineB}</p>
                      </div>
                      <div className="min-w-0 border-t border-slate-200/90 pt-2">
                        <p className="text-xs font-medium text-slate-500">審判</p>
                        <p className="mt-0.5 text-sm leading-snug text-slate-800">
                          {refereeTeamNameOnly(m.referee)}
                        </p>
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>

            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="whitespace-nowrap px-2 py-2 sm:px-3">時間</th>
                    <th className="min-w-0 px-2 py-2 sm:px-3">チームA</th>
                    <th className="min-w-0 px-2 py-2 sm:px-3">チームB</th>
                    <th className="min-w-0 px-2 py-2 sm:px-3">審判</th>
                  </tr>
                </thead>
                <tbody>
                  {matches!.map((m, idx) => {
                    const sl = m.slot;
                    const timeCell = sl
                      ? `${formatHm(sl.startTime)}–${formatHm(sl.endTime)}`
                      : "—";
                    const lunchBreak = shouldShowLunchBreakBetween(matches!, idx);
                    const lunchTime = lunchBreakTimeLabel(matches!, idx);
                    const refCell = refereeTeamNameOnly(m.referee);
                    const nameA = m.sideA.teamName.trim() || "—";
                    const nameB = m.sideB.teamName.trim() || "—";
                    return (
                      <Fragment
                        key={`${m.matchPhase}-${m.slot?.slotCode ?? "s"}-${m.sideA.teamName}-${m.sideB.teamName}-${idx}`}
                      >
                        {lunchBreak ? (
                          <tr
                            className="border-b border-amber-100 bg-amber-50/70"
                            role="note"
                          >
                            <td
                              colSpan={4}
                              className="px-2 py-2.5 text-center text-sm text-slate-800 sm:px-3"
                            >
                              {lunchTime ? (
                                <span className="font-semibold tabular-nums">{lunchTime}</span>
                              ) : null}
                              <span className={lunchTime ? "ml-2 font-medium" : "font-medium"}>
                                昼食休憩
                              </span>
                            </td>
                          </tr>
                        ) : null}
                        <tr className="border-b border-slate-100">
                          <td className="whitespace-nowrap px-2 py-2 align-top tabular-nums sm:px-3">
                            {timeCell}
                          </td>
                          <td className="min-w-0 max-w-xs px-2 py-2 align-top wrap-break-word text-slate-900 sm:px-3">
                            <div className="font-semibold leading-snug">{nameA}</div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-600">
                              {gradeCategoryLineJa(m.sideA)}
                            </div>
                          </td>
                          <td className="min-w-0 max-w-xs px-2 py-2 align-top wrap-break-word text-slate-900 sm:px-3">
                            <div className="font-semibold leading-snug">{nameB}</div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-600">
                              {gradeCategoryLineJa(m.sideB)}
                            </div>
                          </td>
                          <td className="min-w-0 max-w-40 px-2 py-2 align-top wrap-break-word text-slate-800 sm:px-3">
                            {refCell}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
            )}
          </section>

          <div className="sm:hidden">
            <details className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-bold text-slate-900">
                午前の対戦枠（状況）
              </summary>
              <div className="mt-3">
                <MorningSlotsSelect
                  morningSlots={avail.morningSlots}
                  acceptingReservations={avail.acceptingReservations}
                  eventDayStatus={avail.eventDayStatus}
                  selectedSlotId=""
                  onSelectSlot={() => {}}
                  readOnly
                  categoryLegendMode="none"
                  minimalIntro
                  variant="full"
                />
              </div>
            </details>
          </div>
          <div className="hidden sm:block">
            <MorningSlotsSelect
              morningSlots={avail.morningSlots}
              acceptingReservations={avail.acceptingReservations}
              eventDayStatus={avail.eventDayStatus}
              selectedSlotId=""
              onSelectSlot={() => {}}
              readOnly
              categoryLegendMode="none"
              minimalIntro
              variant="full"
            />
          </div>
        </>
      ) : (
        <>
          <MorningSlotsSelect
            morningSlots={avail.morningSlots}
            acceptingReservations={avail.acceptingReservations}
            eventDayStatus={avail.eventDayStatus}
            selectedSlotId=""
            onSelectSlot={() => {}}
            readOnly
            categoryLegendMode="none"
            minimalIntro
            variant="full"
          />

          <section className="rounded-[20px] border border-rp-mint-2 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-rp-navy sm:text-xl">試合スケジュール</h2>
            {isAfterDeadline ? (
              <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                <p className="font-bold text-slate-900">試合スケジュール確認中</p>
                <p>予約受付は締め切りました。</p>
                <p>現在、運営側で試合スケジュールを確認しています。</p>
                <p>確定後、参加チームへメールでご案内します。</p>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                予約締切後にご案内します。
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
