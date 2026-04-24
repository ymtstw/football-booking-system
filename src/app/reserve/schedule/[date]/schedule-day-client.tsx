"use client";

import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MorningSlotsSelect, type MorningSlotSelectRow } from "../../_components/morning-slots-select";
import { IconArrowLeft } from "../../_components/reserve-icons";
import { ReserveMainShell } from "../../_components/ui";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { publicScheduleHubStatusLabel } from "@/lib/event-days/public-schedule-hub-status";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

type AvailabilityJson = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus?: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  /** 有効予約チーム数（枠未選択のチームも含む） */
  activeReservationCount?: number;
  morningSlots: MorningSlotSelectRow[];
  error?: string;
};

type PublicMatch = {
  id: string;
  matchPhase: string;
  assignmentType: string;
  slot: {
    slotCode: string;
    phase: string;
    startTime: string;
    endTime: string;
  } | null;
  sideA: { teamName: string; strengthCategory: string };
  sideB: { teamName: string; strengthCategory: string };
  referee: { teamName: string; strengthCategory: string } | null;
};

type PublicScheduleJson = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
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

function phaseLabelJa(phase: string): string {
  if (phase === "morning") return "午前";
  if (phase === "afternoon") return "午後";
  return phase;
}

export function ScheduleDayClient({ eventDate }: { eventDate: string }) {
  const [avail, setAvail] = useState<AvailabilityJson | null>(null);
  const [schedule, setSchedule] = useState<PublicScheduleJson | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAvailError(null);
      setScheduleError(null);
      try {
        const [aRes, sRes] = await Promise.all([
          fetch(`/api/event-days/${encodeURIComponent(eventDate)}/availability`),
          fetch(`/api/event-days/${encodeURIComponent(eventDate)}/public-schedule`),
        ]);
        const aJson = (await aRes.json().catch(() => ({}))) as AvailabilityJson;
        const sJson = (await sRes.json().catch(() => ({}))) as PublicScheduleJson;
        if (cancelled) return;
        if (!aRes.ok) {
          setAvail(null);
          setSchedule(null);
          setAvailError(
            reserveFlowApiErrorDisplay(
              aRes.status,
              typeof aJson.error === "string" ? aJson.error : undefined,
              "開催日情報を取得できませんでした"
            )
          );
          return;
        }
        setAvail(aJson);
        if (!sRes.ok) {
          setSchedule(null);
          setScheduleError(
            reserveFlowApiErrorDisplay(
              sRes.status,
              typeof sJson.error === "string" ? sJson.error : undefined,
              "試合予定情報の取得に失敗しました"
            )
          );
          return;
        }
        setSchedule(sJson);
      } catch (e) {
        if (cancelled) return;
        setAvail(null);
        setSchedule(null);
        const msg = reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        );
        setAvailError(msg);
        setScheduleError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

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
  const showMatchSection = avail.eventDayStatus === "confirmed";
  const hasMatches = Array.isArray(matches) && matches.length > 0;

  return (
    <div className="space-y-8">
      <Link
        href="/reserve/schedule"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-rp-brand underline"
      >
        <IconArrowLeft className="h-4 w-4" strokeWidth={2} />
        開催確認・試合予定一覧へ
      </Link>

      <ReserveMainShell>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {formatIsoDateWithWeekdayJa(avail.eventDate)}
          </h1>
          <p className="text-sm font-semibold text-slate-700">
            対象学年帯: {gradeBandLabelJa(avail.gradeBand)}
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            このページで、参加チームの枠状況・試合スケジュール（確定後）・開催可否の目安を確認できます。
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            試合の組み方や中止の最終判断は、前日17:30頃までにメールでもご案内します。
          </p>
          <p className="text-xs text-slate-600">
            参加チーム：
            {typeof avail.activeReservationCount === "number" ? avail.activeReservationCount : 0}チーム
            <span className="mx-1.5 text-slate-400" aria-hidden>
              ｜
            </span>
            開催ステータス：
            {
              publicScheduleHubStatusLabel({
                status: String(avail.eventDayStatus ?? ""),
                acceptingReservations: avail.acceptingReservations,
              }).label
            }
          </p>
        </div>
      </ReserveMainShell>

      <MorningSlotsSelect
        morningSlots={avail.morningSlots}
        acceptingReservations={avail.acceptingReservations}
        eventDayStatus={avail.eventDayStatus}
        selectedSlotId=""
        onSelectSlot={() => {}}
        readOnly
        subheading="各枠に入っている参加チーム（閲覧のみ）。予約手続き画面と同じ集計です。"
        variant="full"
      />

      <section className="rounded-[20px] border border-rp-mint-2 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold text-rp-navy sm:text-xl">試合スケジュール（編成確定後）</h2>
        {scheduleError && showMatchSection ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {scheduleError}
          </p>
        ) : null}
        {!showMatchSection ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            編成が確定（開催決定）すると、ここに当日の試合スケジュールを表示します。
          </p>
        ) : scheduleError ? null : !hasMatches ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            開催決定ですが、試合データがまだ登録されていないか、取得できませんでした。しばらくしてから再度お試しください。
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[520px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="px-2 py-2 sm:px-3">枠</th>
                  <th className="px-2 py-2 sm:px-3">区分</th>
                  <th className="px-2 py-2 sm:px-3">対戦</th>
                  <th className="px-2 py-2 sm:px-3">審判</th>
                </tr>
              </thead>
              <tbody>
                {matches!.map((m) => {
                  const sl = m.slot;
                  const timeCell = sl
                    ? `${formatHm(sl.startTime)}–${formatHm(sl.endTime)}（${sl.slotCode}）`
                    : "—";
                  const phaseCell = `${phaseLabelJa(m.matchPhase)}`;
                  const vs = `${m.sideA.teamName}（${strengthCategoryLabelJa(m.sideA.strengthCategory)}） vs ${m.sideB.teamName}（${strengthCategoryLabelJa(m.sideB.strengthCategory)}）`;
                  const refCell = m.referee
                    ? `${m.referee.teamName}（${strengthCategoryLabelJa(m.referee.strengthCategory)}）`
                    : "—";
                  return (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap px-2 py-2 align-top sm:px-3">{timeCell}</td>
                      <td className="whitespace-nowrap px-2 py-2 align-top sm:px-3">{phaseCell}</td>
                      <td className="px-2 py-2 align-top text-slate-900 sm:px-3">{vs}</td>
                      <td className="px-2 py-2 align-top text-slate-700 sm:px-3">{refCell}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-sm leading-relaxed text-slate-600">
        予約の変更・取消は{" "}
        <Link href="/reserve/manage" className="font-semibold text-rp-brand underline">
          予約の確認・キャンセル
        </Link>
        から行えます（確認コードが必要です）。
      </p>
      <p className="text-center text-xs leading-relaxed text-slate-500">
        ※試合の組み合わせや開催可否の最終確定は、メール案内とあわせてご確認ください。
      </p>
    </div>
  );
}
