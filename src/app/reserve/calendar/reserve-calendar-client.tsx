"use client";

/** 画面2: 開催日を選ぶ（確認チェック + カレンダー + 午前枠） */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition as runConcurrentTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { MorningSlotsSelect } from "../_components/morning-slots-select";
import type { MorningSlotSelectRow } from "../_components/morning-slots-select";
import {
  allPreChecksOk,
  ReservePreChecklist,
} from "../_components/reserve-pre-checklist";
import { ReserveStepper } from "../_components/reserve-stepper";
import { IconCalendar } from "../_components/reserve-icons";
import {
  ReserveCallout,
  ReservePrimaryCtaButton,
  ReserveSubPanel,
} from "../_components/ui";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { initialYearMonthFromEvents } from "@/lib/dates/tokyo-calendar-grid";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";

import {
  ReserveEventDaysCalendar,
  type EventDayPublic,
} from "../reserve-event-days-calendar";

type AvailabilityJson = {
  eventDate: string;
  eventDayId: string;
  gradeBand: string;
  eventDayStatus?: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  morningSlots: MorningSlotSelectRow[];
  error?: string;
};

export function ReserveCalendarClient() {
  const router = useRouter();
  const [navPending, startNavTransition] = useTransition();
  const [checked, setChecked] = useState<boolean>(false);
  const [days, setDays] = useState<EventDayPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityJson | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  /** 確認チェック未同意のまま進もうとしたとき、主CTA付近に表示 */
  const [agreementHint, setAgreementHint] = useState<string | null>(null);

  const toggleCheck = useCallback((value: boolean) => {
    setChecked(value);
    if (value) setAgreementHint(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/event-days");
        const json = (await res.json().catch(() => ({}))) as {
          eventDays?: EventDayPublic[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(
            reserveFlowApiErrorDisplay(res.status, json.error, "一覧の取得に失敗しました")
          );
          setDays([]);
          return;
        }
        setDays(json.eventDays ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(
          reserveFlowUserVisibleMessage(
            e instanceof Error ? e.message : String(e),
            RESERVE_FLOW_NETWORK_ERROR_JA
          )
        );
        setDays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const calendarInitialMonth = useMemo(() => {
    if (!days || days.length === 0) return null;
    return initialYearMonthFromEvents(days.map((d) => d.event_date));
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    runConcurrentTransition(() => {
      if (!selectedIsoDate) {
        setAvailability(null);
        setSelectedSlotId("");
        setAvailLoading(false);
        return;
      }
      setAvailLoading(true);
      fetch(`/api/event-days/${encodeURIComponent(selectedIsoDate)}/availability`)
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as AvailabilityJson & {
            error?: string;
          };
          return { res, json };
        })
        .then(({ res, json }) => {
          if (cancelled) return;
          if (!res.ok) {
            setAvailability(null);
            setSelectedSlotId("");
            return;
          }
          setAvailability(json);
          setSelectedSlotId("");
        })
        .catch(() => {
          if (cancelled) return;
          setAvailability(null);
        })
        .finally(() => {
          if (!cancelled) setAvailLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIsoDate]);

  const checksOk = allPreChecksOk(checked);
  /** 日付・枠・受付可否のみでボタン活性を決める（確認チェックはクリック時に検証） */
  const selectionReady =
    Boolean(selectedIsoDate) &&
    Boolean(selectedSlotId) &&
    Boolean(availability?.acceptingReservations);

  return (
    <div className="space-y-8 sm:space-y-10">
      <ReserveStepper current={1} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <ReservePreChecklist checked={checked} onToggle={toggleCheck} />

        <div className="min-w-0 space-y-6">
          {error ? (
            <ReserveCallout tone="red" className="px-4 py-3 text-sm">
              {error}
            </ReserveCallout>
          ) : null}

          {days === null && !error && (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-600" role="status">
              <InlineSpinner size="md" variant="onLight" />
              <p>開催日を読み込み中…</p>
            </div>
          )}

          {days && days.length === 0 && !error && (
            <ReserveCallout tone="slate" className="p-6 text-center text-sm">
              現在、公開中の開催日はありません。
            </ReserveCallout>
          )}

          {days && days.length > 0 && calendarInitialMonth && (
            <ReserveSubPanel
              title="カレンダー"
              titleIcon={
                <IconCalendar className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.65} />
              }
              description="受付中の日付を選ぶと、午前の対戦枠が表示されます。"
            >
              <ReserveEventDaysCalendar
                key={`${calendarInitialMonth.year}-${calendarInitialMonth.month}-${selectedIsoDate ?? ""}`}
                days={days}
                initialYearMonth={calendarInitialMonth}
                bookableInteraction="select"
                selectedIsoDate={selectedIsoDate}
                onBookableDateSelect={(iso) => {
                  setSelectedIsoDate(iso);
                }}
              />
            </ReserveSubPanel>
          )}

          {selectedIsoDate ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                <p className="text-xs font-semibold text-slate-500">選択中の開催日</p>
                <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {formatIsoDateWithWeekdayJa(selectedIsoDate)}
                </p>
              </div>
              {availLoading ? (
                <p className="text-sm text-slate-500" role="status">
                  枠を読み込み中…
                </p>
              ) : availability ? (
                <MorningSlotsSelect
                  morningSlots={availability.morningSlots}
                  acceptingReservations={availability.acceptingReservations}
                  eventDayStatus={availability.eventDayStatus}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={setSelectedSlotId}
                  variant="compact"
                  showCategoryLegend={false}
                />
              ) : (
                <p className="text-sm text-slate-600">この日の枠情報を取得できませんでした。</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">まずカレンダーから開催日を選んでください。</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-8">
        <div className="flex w-full min-w-0 flex-col gap-2">
          {agreementHint ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {agreementHint}
            </p>
          ) : null}
          <ReservePrimaryCtaButton
            disabled={!selectionReady || navPending}
            pending={navPending}
            onClick={() => {
              if (!selectionReady || !selectedIsoDate || !selectedSlotId) return;
              if (!checksOk) {
                setAgreementHint("確認事項をご覧になり、同意してください。");
                return;
              }
              setAgreementHint(null);
              startNavTransition(() => {
                router.push(
                  `/reserve/${selectedIsoDate}?morningSlot=${encodeURIComponent(selectedSlotId)}`
                );
              });
            }}
          >
            この日程で予約情報を入力する
          </ReservePrimaryCtaButton>
        </div>
        <p className="text-center text-sm">
          <Link
            href="/"
            className="font-semibold text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
          >
            イベント案内に戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
