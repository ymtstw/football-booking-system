"use client";

/** 画面2: 開催日を選ぶ（確認チェック + カレンダー + 午前枠） */
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { MorningSlotsSelect } from "../_components/morning-slots-select";
import type { MorningSlotSelectRow } from "../_components/morning-slots-select";
import {
  allPreChecksOk,
  PRE_CHECKLIST_COUNT,
  ReservePreChecklist,
} from "../_components/reserve-pre-checklist";
import { ReserveStepper } from "../_components/reserve-stepper";
import { IconCalendar } from "../_components/reserve-icons";
import {
  ReserveCallout,
  ReserveOutlineRoundLink,
  ReservePrimaryCtaButton,
  ReserveSoftGreenLink,
  ReserveSubPanel,
} from "../_components/ui";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { initialYearMonthFromEvents } from "@/lib/dates/tokyo-calendar-grid";

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
  const [checked, setChecked] = useState<boolean[]>(() =>
    Array.from({ length: PRE_CHECKLIST_COUNT }, () => false)
  );
  const [days, setDays] = useState<EventDayPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityJson | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");

  const toggleCheck = useCallback((index: number, value: boolean) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/event-days");
      const json = (await res.json().catch(() => ({}))) as {
        eventDays?: EventDayPublic[];
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "一覧の取得に失敗しました");
        setDays([]);
        return;
      }
      setDays(json.eventDays ?? []);
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
    startTransition(() => {
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
  const canProceed =
    checksOk &&
    Boolean(selectedIsoDate) &&
    Boolean(selectedSlotId) &&
    availability?.acceptingReservations;

  return (
    <div className="space-y-8 sm:space-y-10">
      <ReserveStepper current={2} />

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

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-8 lg:flex-row lg:items-center lg:justify-between">
        <ReserveOutlineRoundLink href="/reserve">予約に戻る</ReserveOutlineRoundLink>
        <ReserveSoftGreenLink href="/reserve/camp">合宿のご相談</ReserveSoftGreenLink>
        <ReservePrimaryCtaButton
          disabled={!canProceed}
          onClick={() => {
            if (!selectedIsoDate || !selectedSlotId) return;
            router.push(
              `/reserve/${selectedIsoDate}?morningSlot=${encodeURIComponent(selectedSlotId)}`
            );
          }}
        >
          この日程で予約情報を入力する
        </ReservePrimaryCtaButton>
      </div>
    </div>
  );
}
