"use client";

/** 画面2: 開催日を選ぶ（確認事項・カレンダー・午前枠） */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition as runConcurrentTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { MorningSlotsSelect } from "../_components/morning-slots-select";
import type { MorningSlotSelectRow } from "../_components/morning-slots-select";
import {
  allPreChecksOk,
  ReservePreCheckAgreement,
} from "../_components/reserve-pre-checklist";
import { ReserveStepper } from "../_components/reserve-stepper";
import { IconX } from "../_components/reserve-icons";
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

/** Tailwind `md` 未満（スマホ想定） */
function useIsBelowMd() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setV(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return v;
}

const SLOT_SUBHEADING = "午後は、参加チームごとに最低1試合を確保します。";

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
  const [agreementHint, setAgreementHint] = useState<string | null>(null);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const isBelowMd = useIsBelowMd();
  const lastAutoOpenDateRef = useRef<string | null>(null);

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

  /** スマホ: 日付タップは常に「その日を選んだ」扱い（再タップで解除しない）。同じ日なら枠モーダルを開き直す。 */
  const handleBookableDateSelect = useCallback(
    (iso: string) => {
      if (isBelowMd) {
        setSelectedIsoDate((current) => {
          if (current === iso) {
            queueMicrotask(() => {
              setSlotModalOpen(true);
            });
          }
          return iso;
        });
        return;
      }
      setSelectedIsoDate((current) => (current === iso ? null : iso));
    },
    [isBelowMd]
  );

  useEffect(() => {
    let cancelled = false;
    runConcurrentTransition(() => {
      if (!selectedIsoDate) {
        setAvailability(null);
        setSelectedSlotId("");
        setAvailLoading(false);
        lastAutoOpenDateRef.current = null;
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

  /** スマホ: 開催日を選んだら枠モーダルを開く（同意済みで枠表示／未同意は案内） */
  useEffect(() => {
    if (!isBelowMd || !selectedIsoDate || !availability || availLoading) return;
    if (lastAutoOpenDateRef.current === selectedIsoDate) return;
    lastAutoOpenDateRef.current = selectedIsoDate;
    queueMicrotask(() => {
      setSlotModalOpen(true);
    });
  }, [isBelowMd, selectedIsoDate, availability, availLoading]);

  useEffect(() => {
    if (!selectedIsoDate) {
      lastAutoOpenDateRef.current = null;
      queueMicrotask(() => {
        setSlotModalOpen(false);
      });
    }
  }, [selectedIsoDate]);

  useEffect(() => {
    if (!isBelowMd) {
      queueMicrotask(() => {
        setSlotModalOpen(false);
      });
    }
  }, [isBelowMd]);

  useEffect(() => {
    if (!slotModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlotModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slotModalOpen]);

  useEffect(() => {
    if (!isBelowMd || !slotModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isBelowMd, slotModalOpen]);

  const checksOk = allPreChecksOk(checked);
  const morningSlotPicked = Boolean(selectedSlotId.trim());
  const selectionReady =
    Boolean(selectedIsoDate) &&
    Boolean(availability?.acceptingReservations) &&
    morningSlotPicked;

  const goToReserveInput = useCallback(() => {
    if (!selectionReady || !selectedIsoDate) return;
    if (!checksOk) {
      setAgreementHint("ご予約前の確認事項をご覧になり、同意してください。");
      setSlotModalOpen(false);
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          document.getElementById("reserve-pre-checklist")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          document.getElementById("reserve-pre-checklist-checkbox")?.focus({ preventScroll: true });
        });
      });
      return;
    }
    setAgreementHint(null);
    setSlotModalOpen(false);
    startNavTransition(() => {
      const q = selectedSlotId.trim()
        ? `?morningSlot=${encodeURIComponent(selectedSlotId)}`
        : "";
      router.push(`/reserve/${selectedIsoDate}${q}`);
    });
  }, [
    selectionReady,
    selectedIsoDate,
    selectedSlotId,
    checksOk,
    router,
    startNavTransition,
  ]);

  const slotPanel = availability ? (
    <MorningSlotsSelect
      morningSlots={availability.morningSlots}
      acceptingReservations={availability.acceptingReservations}
      eventDayStatus={availability.eventDayStatus}
      selectedSlotId={selectedSlotId}
      onSelectSlot={setSelectedSlotId}
      sectionHeading="午前の希望時間を選ぶ"
      variant="compact"
      categoryLegendMode="compact"
      subheading={SLOT_SUBHEADING}
      showAfternoonScheduleHint
    />
  ) : null;

  const scrollToPreCheck = useCallback(() => {
    setSlotModalOpen(false);
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        document.getElementById("reserve-pre-checklist")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }, []);

  return (
    <div className="space-y-8 sm:space-y-10">
      <ReserveStepper current={1} />

      <ReservePreCheckAgreement
        checked={checked}
        onToggle={toggleCheck}
        layout={isBelowMd ? "mobile" : "desktop"}
        sectionId="reserve-pre-checklist"
        checkboxId="reserve-pre-checklist-checkbox"
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
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
            <ReserveSubPanel>
              <ReserveEventDaysCalendar
                key={`${calendarInitialMonth.year}-${calendarInitialMonth.month}-${selectedIsoDate ?? ""}`}
                days={days}
                initialYearMonth={calendarInitialMonth}
                bookableInteraction="select"
                selectedIsoDate={selectedIsoDate}
                onBookableDateSelect={handleBookableDateSelect}
              />
            </ReserveSubPanel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {!selectedIsoDate ? (
            <ReserveCallout tone="slate" className="p-5 text-sm leading-relaxed text-slate-700">
              カレンダーで開催日を選ぶと、ここに選択日と午前枠の操作が表示されます。
            </ReserveCallout>
          ) : (
            <>
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
                <>
                  {isBelowMd ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-green-600 bg-green-50 px-4 text-sm font-bold text-green-800 transition-colors hover:bg-green-100"
                        onClick={() => setSlotModalOpen(true)}
                      >
                        予約状況を表示
                      </button>
                      {availability.acceptingReservations &&
                      !morningSlotPicked &&
                      checksOk ? (
                        <p
                          role="status"
                          className="text-sm leading-relaxed text-slate-600"
                        >
                          「予約状況を表示」から午前の希望時間を1つお選びください。
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    slotPanel
                  )}
                  {!isBelowMd &&
                  availability.acceptingReservations &&
                  !morningSlotPicked &&
                  checksOk ? (
                    <p
                      role="status"
                      className="text-sm leading-relaxed text-slate-600"
                    >
                      予約に進む前に、上の一覧から午前の希望時間を1つお選びください。
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-600">この日の枠情報を取得できませんでした。</p>
              )}
              {!isBelowMd ? (
                <>
                  {agreementHint ? (
                    <p className="text-sm font-medium text-red-600" role="alert">
                      {agreementHint}
                    </p>
                  ) : null}
                  <ReservePrimaryCtaButton
                    disabled={!selectionReady || navPending}
                    pending={navPending}
                    onClick={goToReserveInput}
                  >
                    予約情報を入力する
                  </ReservePrimaryCtaButton>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-8">
        <p className="text-center text-sm">
          <Link
            href="/"
            className="font-semibold text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
          >
            イベント案内に戻る
          </Link>
        </p>
      </div>

      {isBelowMd && slotModalOpen && selectedIsoDate && availability ? (
        <div className="fixed inset-0 z-60 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="閉じる"
            onClick={() => setSlotModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-slot-sheet-title"
            className="absolute bottom-0 left-0 right-0 z-1 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2
                id="reserve-slot-sheet-title"
                className="text-base font-bold text-green-800 sm:text-lg"
              >
                {checksOk ? "予約状況" : "確認事項の同意が必要です"}
              </h2>
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="閉じる"
                onClick={() => setSlotModalOpen(false)}
              >
                <IconX className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {!checksOk ? (
              <div className="space-y-4 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <p className="text-sm leading-relaxed text-slate-700">
                  予約状況を見る前に、上部の確認事項をご確認ください。
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-green-600 bg-green-50 px-4 text-sm font-bold text-green-800 transition-colors hover:bg-green-100"
                  onClick={scrollToPreCheck}
                >
                  確認事項へ移動
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 pt-1">
                  {slotPanel}
                </div>
                <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {agreementHint ? (
                    <p className="text-sm font-medium text-red-600" role="alert">
                      {agreementHint}
                    </p>
                  ) : null}
                  <ReservePrimaryCtaButton
                    disabled={!selectionReady || navPending}
                    pending={navPending}
                    onClick={goToReserveInput}
                  >
                    予約情報を入力する
                  </ReservePrimaryCtaButton>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
