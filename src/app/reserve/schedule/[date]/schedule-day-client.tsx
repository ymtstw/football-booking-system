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
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

type AvailabilityJson = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus?: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
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
              "対戦表情報の取得に失敗しました"
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
          対戦表・スケジュール一覧へ
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
        一覧へ戻る
      </Link>

      <ReserveMainShell>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {formatIsoDateWithWeekdayJa(avail.eventDate)}
          </h1>
          <p className="text-sm font-semibold text-slate-700">
            対象学年帯: {gradeBandLabelJa(avail.gradeBand)}
          </p>
          <p className="text-xs text-slate-500">
            ステータス:{" "}
            {avail.eventDayStatus === "confirmed"
              ? "編成確定"
              : avail.eventDayStatus === "locked"
                ? "締切後（編成作業中の場合があります）"
                : avail.eventDayStatus === "open"
                  ? "受付中"
                  : avail.eventDayStatus === "cancelled_weather"
                    ? "雨天中止"
                    : avail.eventDayStatus === "cancelled_operational"
                      ? "運営中止"
                      : avail.eventDayStatus === "cancelled_minimum"
                        ? "最少未達中止"
                        : avail.eventDayStatus ?? "—"}
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
        subheading="予約手続きと同じ内容の枠状況です（閲覧のみ）。"
        variant="full"
      />

      <section className="rounded-[20px] border border-rp-mint-2 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold text-rp-navy sm:text-xl">対戦表（確定後）</h2>
        {scheduleError && showMatchSection ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {scheduleError}
          </p>
        ) : null}
        {!showMatchSection ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            開催日の編成が確定（確定済ステータス）になると、ここに当日の対戦表を表示します。締切後は運営の作業状況により、表示までにお時間がかかる場合があります。
          </p>
        ) : scheduleError ? null : !hasMatches ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            確定済ですが、対戦表データがまだ登録されていないか、取得できませんでした。しばらくしてから再度お試しください。
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

      <p className="text-center text-sm text-slate-600">
        予約の確認・変更・キャンセルは{" "}
        <Link href="/reserve/manage" className="font-semibold text-rp-brand underline">
          予約の確認・キャンセル
        </Link>
        から（確認コードが必要です）。
      </p>
    </div>
  );
}
