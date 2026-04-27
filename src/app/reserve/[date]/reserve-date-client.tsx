"use client";

/** SCR-01: 指定日の予約フォーム（午前枠はカレンダーで選択し URL 引き継ぎ）→ SCR-02 へ sessionStorage で遷移。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FieldLabel } from "../_components/field-label";
import { LunchPaymentNote } from "../_components/lunch-payment-note";
import { IconArrowRight } from "../_components/reserve-icons";
import { ReserveStepper } from "../_components/reserve-stepper";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import {
  isContactPhoneDigitsValid,
  normalizeContactPhoneDigits,
} from "@/lib/validators/contact-phone";
import { inputAsciiDigitsOnly } from "@/lib/validators/digits-input";
import {
  isReserveContactNameOk,
  RESERVE_CONTACT_NAME_MAX_CHARS,
} from "@/lib/validators/reserve-contact-name";
import {
  gradeYearLabelJa,
  representativeGradeYearChoicesForBand,
} from "@/lib/reservations/grade-year";
import {
  isAtLeastFourDigitCount,
  RESERVE_COUNT_MAX_ALLOWED,
  RESERVE_COUNT_REJECT_FROM,
} from "@/lib/reservations/reserve-numeric-sanity";
import { RESERVE_STRENGTH_OPTIONS } from "@/lib/reservations/strength-labels";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import {
  LUNCH_MENU_QTY_MAX_DIGITS,
  LUNCH_MENU_QTY_PARSE_HELP_JA,
  parseLunchQuantityField,
} from "@/lib/lunch/parse-lunch-qty-field";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";
import {
  RESERVE_LUNCH_ORDER_HELP_LINES_JA,
  RESERVE_PARTICIPANT_COUNT_HINT_JA,
} from "@/lib/copy/reserve-participant-lunch-hints";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import {
  RESERVE_DATE_HEADER_BACK_REQUEST,
  RESERVE_DATE_PHASE_BROADCAST,
} from "@/lib/reserve/reserve-header-flow-events";

const SESSION_COMPLETE_KEY = "football_reservation_complete_v1";

type MorningSlot = {
  id: string;
  slotCode: string;
  startTime: string;
  endTime: string;
  capacity: number;
  activeCount: number;
  full: boolean;
  bookable: boolean;
  isLocked: boolean;
  byCategory?: {
    strong: number;
    potential: number;
    unknown: number;
  };
  bookedTeams?: Array<{
    reservationId: string;
    teamName: string;
    strengthCategory: string;
    /** 1〜6。旧データで欠ける場合は未表示 */
    representativeGradeYear?: number | null;
  }>;
};

type AvailabilityJson = {
  eventDate: string;
  eventDayId: string;
  gradeBand: string;
  /** open / locked / confirmed（一覧と同じ） */
  eventDayStatus?: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  morningSlots: MorningSlot[];
  error?: string;
};

function pickInitialMorningSlot(
  json: AvailabilityJson,
  morningId: string | undefined
): string {
  const id = morningId?.trim();
  if (!id || !json.acceptingReservations || !json.morningSlots?.length) return "";
  const s = json.morningSlots.find((x) => x.id === id);
  return s?.bookable ? id : "";
}

function gradeBandLabelJa(band: string): string {
  const g = band.trim();
  if (g === "1-2") return "1〜2年生";
  if (g === "3-4") return "3〜4年生";
  if (g === "5-6") return "5〜6年生";
  return g;
}

type AvailabilityLoadIssue =
  | null
  /** 公開中の開催日が無い（404）。DB リセット直後・未公開・ブックマークの古い日付など */
  | { kind: "no_open_day" }
  /** 5xx や想定外の 4xx、通信失敗 */
  | { kind: "error"; message: string };

export function ReserveDateClient({
  eventDate,
  initialMorningSlotId,
}: {
  eventDate: string;
  /** 開催日選択画面から引き継いだ午前枠（任意） */
  initialMorningSlotId?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<AvailabilityJson | null>(null);
  const [loadIssue, setLoadIssue] = useState<AvailabilityLoadIssue>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [strengthCategory, setStrengthCategory] = useState<string>("strong");
  const [representativeGradeYear, setRepresentativeGradeYear] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactEmailConfirm, setContactEmailConfirm] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  /** 入力画面 → 登録前の内容確認 */
  const [phase, setPhase] = useState<"edit" | "confirm">("edit");
  const [participantCount, setParticipantCount] = useState("18");
  const [lunchMenus, setLunchMenus] = useState<LunchMenuItemPublic[] | null>(null);
  const [lunchMenuLoadError, setLunchMenuLoadError] = useState<string | null>(null);
  const [qtyByMenuId, setQtyByMenuId] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** ヘッダー戻るボタンと入力／確認フェーズを同期 */
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(RESERVE_DATE_PHASE_BROADCAST, { detail: { phase } })
    );
  }, [phase]);

  useEffect(() => {
    const onHeaderBack = () => {
      setPhase((prev) => {
        if (prev === "confirm") return "edit";
        queueMicrotask(() => {
          router.push("/reserve/calendar");
        });
        return prev;
      });
    };
    window.addEventListener(RESERVE_DATE_HEADER_BACK_REQUEST, onHeaderBack);
    return () => window.removeEventListener(RESERVE_DATE_HEADER_BACK_REQUEST, onHeaderBack);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/event-days/${encodeURIComponent(eventDate)}/availability`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as AvailabilityJson & {
          error?: string;
        };
        return { res, json };
      })
      .then(({ res, json }) => {
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          if (res.status === 404) {
            setLoadIssue({ kind: "no_open_day" });
            return;
          }
          setLoadIssue({
            kind: "error",
            message: reserveFlowApiErrorDisplay(
              res.status,
              typeof json.error === "string" ? json.error : undefined,
              `空き状況を取得できませんでした（${res.status}）`
            ),
          });
          return;
        }
        setData(json);
        setLoadIssue(null);
        setSelectedSlotId(pickInitialMorningSlot(json, initialMorningSlotId));
        {
          const first = representativeGradeYearChoicesForBand(json.gradeBand)[0];
          setRepresentativeGradeYear(first != null ? String(first) : "");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoadIssue({ kind: "error", message: RESERVE_FLOW_NETWORK_ERROR_JA });
      });
    return () => {
      cancelled = true;
    };
  }, [eventDate, initialMorningSlotId]);

  useEffect(() => {
    const eventDayId = data?.eventDayId?.trim();
    if (!eventDayId) {
      setLunchMenus(null);
      setLunchMenuLoadError(null);
      setQtyByMenuId({});
      return;
    }

    let cancelled = false;
    fetch(
      `/api/lunch-menu?eventDayId=${encodeURIComponent(eventDayId)}`
    )
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          items?: LunchMenuItemPublic[];
          error?: string;
        };
        return { res, j };
      })
      .then(({ res, j }) => {
        if (cancelled) return;
        if (!res.ok) {
          setLunchMenus([]);
          setLunchMenuLoadError(
            reserveFlowApiErrorDisplay(
              res.status,
              typeof j.error === "string" ? j.error : undefined,
              "昼食メニューを取得できませんでした"
            )
          );
          return;
        }
        setLunchMenuLoadError(null);
        const items = Array.isArray(j.items) ? j.items : [];
        setLunchMenus(items);
        setQtyByMenuId(Object.fromEntries(items.map((m) => [m.id, ""])));
      })
      .catch(() => {
        if (cancelled) return;
        setLunchMenus([]);
        setLunchMenuLoadError(RESERVE_FLOW_NETWORK_ERROR_JA);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.eventDayId]);

  useEffect(() => {
    if (phase !== "confirm") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  const gradeYearChoices = useMemo(
    () => (data ? representativeGradeYearChoicesForBand(data.gradeBand) : []),
    [data]
  );

  function validateBeforeConfirm(): {
    ok: true;
    lunchItems: { menuItemId: string; quantity: number }[];
    participantCount: number;
    representativeGradeYear: number;
    phoneDigits: string;
  } | { ok: false; message: string; alert?: string } {
    if (!data?.eventDayId) {
      return { ok: false, message: "開催日情報がありません" };
    }
    if (!selectedSlotId) {
      return {
        ok: false,
        message: "午前の希望枠は、開催日選択（カレンダー）画面でお選びください。",
      };
    }
    const pc = parseInt(participantCount, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      return { ok: false, message: "参加人数は 1 以上の整数にしてください" };
    }
    if (isAtLeastFourDigitCount(pc)) {
      return {
        ok: false,
        message: `参加人数は ${RESERVE_COUNT_MAX_ALLOWED} 以下の整数にしてください。`,
        alert: `参加人数が ${RESERVE_COUNT_REJECT_FROM} 以上です。\n誤入力でないかご確認ください。`,
      };
    }
    if (!lunchMenus || lunchMenus.length === 0) {
      return {
        ok: false,
        message: "昼食メニューを読み込めていません。しばらくしてから再度お試しください",
      };
    }
    const lunchItems: { menuItemId: string; quantity: number }[] = [];
    let lunchTotalUnits = 0;
    for (const m of lunchMenus) {
      const parsed = parseLunchQuantityField(qtyByMenuId[m.id]);
      if (!parsed.ok) {
        const msg = `昼食数は ${LUNCH_MENU_QTY_PARSE_HELP_JA}`;
        return { ok: false, message: msg, alert: msg };
      }
      lunchItems.push({ menuItemId: m.id, quantity: parsed.quantity });
      lunchTotalUnits += parsed.quantity;
    }
    if (lunchTotalUnits === 0) {
      return { ok: false, message: "昼食は、必ずご予約が必要です。", alert: "昼食は、必ずご予約が必要です。" };
    }
    if (isAtLeastFourDigitCount(lunchTotalUnits)) {
      return {
        ok: false,
        message: `昼食の食数の合計は ${RESERVE_COUNT_MAX_ALLOWED} 以下にしてください。`,
        alert: `昼食の食数の合計が ${RESERVE_COUNT_REJECT_FROM} 以上です。\n誤入力でないかご確認ください。`,
      };
    }
    if (
      !teamName.trim() ||
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactEmailConfirm.trim() ||
      !contactPhone.trim()
    ) {
      return {
        ok: false,
        message: "チーム名・代表者名・メール（2回）・電話は必須です",
      };
    }
    if (!isReserveContactNameOk(contactName.trim())) {
      return {
        ok: false,
        message: `チーム代表者名は${RESERVE_CONTACT_NAME_MAX_CHARS}文字以内で入力してください`,
      };
    }
    const emailA = contactEmail.trim().toLowerCase();
    const emailB = contactEmailConfirm.trim().toLowerCase();
    if (emailA !== emailB) {
      return {
        ok: false,
        message: "メールアドレスが一致しません。同じ内容を2回入力してください。",
        alert: "メールアドレスが一致しません。\n入力内容をご確認ください。",
      };
    }
    if (!["strong", "potential"].includes(strengthCategory)) {
      return { ok: false, message: "チームカテゴリを選んでください" };
    }
    const gy = parseInt(representativeGradeYear, 10);
    if (!Number.isInteger(gy) || !gradeYearChoices.includes(gy)) {
      return { ok: false, message: "代表学年を選んでください" };
    }
    const phoneDigits = normalizeContactPhoneDigits(contactPhone);
    if (!isContactPhoneDigitsValid(phoneDigits)) {
      return {
        ok: false,
        message:
          "電話番号は数字のみ、10〜15桁で入力してください（ハイフンは不要です）",
      };
    }
    return {
      ok: true,
      lunchItems,
      participantCount: pc,
      representativeGradeYear: gy,
      phoneDigits,
    };
  }

  function handleGoToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const v = validateBeforeConfirm();
    if (!v.ok) {
      if (v.alert) window.alert(v.alert);
      setSubmitError(v.message);
      return;
    }
    setPhase("confirm");
  }

  async function performSubmit() {
    setSubmitError(null);
    const v = validateBeforeConfirm();
    if (!v.ok) {
      setPhase("edit");
      if (v.alert) window.alert(v.alert);
      setSubmitError(v.message);
      return;
    }
    if (!data?.eventDayId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDayId: data.eventDayId,
          selectedMorningSlotId: selectedSlotId,
          team: {
            teamName: teamName.trim(),
            strengthCategory,
            representativeGradeYear: v.representativeGradeYear,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: v.phoneDigits,
          },
          participantCount: v.participantCount,
          lunchItems: v.lunchItems,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        reservationId?: string;
        reservationToken?: string;
        reservationTokenDisplay?: string;
        publicRef?: string;
      };

      if (!res.ok) {
        const combined =
          typeof json.detail === "string" && json.detail.trim()
            ? json.detail
            : json.error;
        setSubmitError(
          reserveFlowApiErrorDisplay(
            res.status,
            combined,
            `送信に失敗しました（${res.status}）`
          )
        );
        return;
      }
      if (!json.reservationToken || !json.reservationId || !json.publicRef) {
        setSubmitError(
          "予約は完了したが表示用データが返りませんでした。運営へ連絡してください。"
        );
        return;
      }

      try {
        sessionStorage.setItem(
          SESSION_COMPLETE_KEY,
          JSON.stringify({
            reservationToken: json.reservationToken,
            reservationTokenDisplay:
              json.reservationTokenDisplay ?? json.reservationToken,
            publicRef: json.publicRef,
            reservationId: json.reservationId,
            eventDate: data.eventDate,
          })
        );
      } catch {
        setSubmitError(
          "ブラウザの保存領域に書き込めませんでした。別ブラウザでお試しください。"
        );
        return;
      }

      router.push("/reserve/complete");
    } catch (e) {
      setSubmitError(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  const strengthLabel =
    RESERVE_STRENGTH_OPTIONS.find((o) => o.value === strengthCategory)?.label ??
    strengthCategory;
  const selectedMorningSlot = data?.morningSlots.find((s) => s.id === selectedSlotId) ?? null;
  const hasBookableMorningSlot = Boolean(
    data?.morningSlots.some((s) => s.bookable)
  );
  const hasValidSelectedMorningSlot = Boolean(
    selectedMorningSlot?.bookable === true
  );
  const showReserveForm =
    Boolean(data?.acceptingReservations) && hasValidSelectedMorningSlot;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ReserveStepper
        current={phase === "confirm" ? 3 : 2}
        density={phase === "confirm" ? "compact" : "default"}
      />

      {phase === "edit" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-800 sm:text-xl">
            {formatIsoDateWithWeekdayJa(eventDate)} の予約
          </h1>
          {data && hasValidSelectedMorningSlot && selectedMorningSlot ? (
            <div className="mt-2.5 rounded-lg border border-rp-mint-2 bg-rp-mint/50 px-3 py-1.5 sm:hidden">
              <p className="text-xs font-semibold tabular-nums text-zinc-900">
                <span className="font-semibold text-zinc-700">午前の希望枠：</span>
                {selectedMorningSlot.startTime?.slice(0, 5) ?? ""}–
                {selectedMorningSlot.endTime?.slice(0, 5) ?? ""}
              </p>
            </div>
          ) : null}
          {data ? (
            <div
              className={`mt-2.5 hidden rounded-lg border border-rp-mint-2 bg-rp-mint/50 px-3.5 py-2 sm:grid ${
                hasValidSelectedMorningSlot && selectedMorningSlot
                  ? "sm:grid-cols-3 sm:gap-x-4 sm:gap-y-1"
                  : "sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1"
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium leading-none text-zinc-500">
                  対象学年帯
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {gradeBandLabelJa(data.gradeBand)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-none text-zinc-500">予約締切</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                  {formatDateTimeTokyoWithWeekday(data.reservationDeadlineAt)}
                </p>
              </div>
              {hasValidSelectedMorningSlot && selectedMorningSlot ? (
                <div className="min-w-0 border-l border-rp-mint-2/80 pl-4">
                  <p className="text-xs font-medium leading-none text-zinc-500">午前の希望枠</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                    {selectedMorningSlot.startTime?.slice(0, 5) ?? ""}–
                    {selectedMorningSlot.endTime?.slice(0, 5) ?? ""}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {loadIssue?.kind === "no_open_day" && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-relaxed text-sky-950">
          <p className="font-medium text-sky-950">
            この日（{formatIsoDateWithWeekdayJa(eventDate)}）は、いまのところ
            <strong className="font-semibold"> 公開中の開催がありません</strong>
            。
          </p>
          <p className="mt-2 text-sky-900">
            開催日が未登録・まだ「公開前」のまま・DB をリセットした直後などが考えられます。予約は
            <strong className="font-semibold"> 公開済みの日</strong>
            からお選びください。
          </p>
          <p className="mt-3">
            <Link
              href="/reserve/calendar"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-900 px-4 py-2 text-sm font-medium text-white hover:bg-sky-950"
            >
              開催日選択へ戻る
            </Link>
          </p>
        </div>
      )}

      {loadIssue?.kind === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadIssue.message}
        </p>
      )}

      {!data && !loadIssue && (
        <p className="text-sm text-zinc-500">空き状況を読み込み中…</p>
      )}

      {data && phase === "edit" && (
        <>
          <div className="space-y-6">
            {data.acceptingReservations && !hasBookableMorningSlot ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                <p className="font-semibold">この開催日は、午前の予約枠が埋まっています。</p>
                <p className="mt-1">別の開催日をお選びください。</p>
                <p className="mt-3">
                  <Link
                    href="/reserve/calendar"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950"
                  >
                    開催日選択へ戻る
                  </Link>
                </p>
              </div>
            ) : null}

            {data.acceptingReservations &&
            hasBookableMorningSlot &&
            !hasValidSelectedMorningSlot ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                <p className="font-semibold">午前の希望枠が未選択です</p>
                <p className="mt-1">
                  開催日選択（カレンダー）画面で「午前の希望時間」を選び、
                  <span className="font-medium">予約情報を入力する</span>
                  から再度お進みください。
                </p>
                <p className="mt-3">
                  <Link
                    href="/reserve/calendar"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950"
                  >
                    開催日・午前枠の選択へ戻る
                  </Link>
                </p>
              </div>
            ) : null}

            <form
              onSubmit={handleGoToConfirm}
              className={`space-y-3 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm sm:space-y-6 sm:p-6 lg:p-8 ${!showReserveForm ? "hidden" : ""}`}
              aria-hidden={!showReserveForm}
            >
            <h2 className="text-lg font-bold leading-snug text-rp-navy sm:leading-normal">
              予約情報の入力
            </h2>

            <div className="grid min-w-0 gap-3 sm:gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-2 rounded-xl border border-sky-200/70 bg-sky-50/50 p-2.5 sm:space-y-4 sm:p-5">
                <label className="block text-sm">
                  <FieldLabel required>チーム名</FieldLabel>
                  <input
                    required
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none ring-rp-brand/20 focus:border-rp-brand focus:ring-2 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    autoComplete="organization"
                    placeholder="例：○○サッカークラブ"
                  />
                </label>
                <div className="rounded-xl border border-rp-mint-2 bg-rp-mint/60 px-2 py-1.5 text-xs leading-snug text-zinc-800 sm:px-3 sm:py-2.5 sm:text-sm sm:leading-relaxed">
                  <p className="font-semibold text-rp-brand">カテゴリについて</p>
                  <ul className="mt-0.5 space-y-0.5">
                    <li>
                      <span className="font-medium">ハイレベル</span>
                      ：経験が多く試合に慣れているチーム
                    </li>
                    <li>
                      <span className="font-medium">ポテンシャル</span>
                      ：これから成長していくチーム
                    </li>
                  </ul>
                </div>
                <label className="mt-0.5 block text-sm sm:mt-0">
                  <FieldLabel required>カテゴリを選択</FieldLabel>
                  <select
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2 sm:text-sm"
                    value={strengthCategory}
                    onChange={(e) => setStrengthCategory(e.target.value)}
                  >
                    {RESERVE_STRENGTH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <FieldLabel required>代表学年を選択</FieldLabel>
                  <select
                    required
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2 sm:text-sm"
                    value={representativeGradeYear}
                    onChange={(e) => setRepresentativeGradeYear(e.target.value)}
                  >
                    {gradeYearChoices.map((y) => (
                      <option key={y} value={String(y)}>
                        {gradeYearLabelJa(y)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs leading-snug text-zinc-600 sm:mt-1.5 sm:text-sm sm:leading-normal">
                    複数学年の場合は、人数が多い方の学年を選んでください。
                  </span>
                </label>
                <label className="block text-sm">
                  <FieldLabel required>チーム代表者名</FieldLabel>
                  <input
                    required
                    maxLength={RESERVE_CONTACT_NAME_MAX_CHARS}
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    autoComplete="name"
                    placeholder="例：山田 太郎（監督）"
                  />
                </label>
                <label className="block text-sm">
                  <FieldLabel required>メール</FieldLabel>
                  <input
                    required
                    type="email"
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="block text-sm">
                  <FieldLabel required>メール（確認）</FieldLabel>
                  <input
                    required
                    type="email"
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={contactEmailConfirm}
                    onChange={(e) => setContactEmailConfirm(e.target.value)}
                    autoComplete="off"
                    placeholder="上と同じメールを再入力"
                  />
                  <span className="mt-0.5 block text-xs text-zinc-500 sm:mt-1">
                    確認のため、もう一度同じアドレスを入力してください。
                  </span>
                </label>
                <label className="block text-sm">
                  <FieldLabel required>電話（数字のみ）</FieldLabel>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    placeholder="09012345678"
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={contactPhone}
                    onChange={(e) =>
                      setContactPhone(normalizeContactPhoneDigits(e.target.value))
                    }
                    autoComplete="tel"
                  />
                  <span className="mt-0.5 block text-xs text-zinc-500 sm:mt-1">
                    10〜15 桁・ハイフン不要（保存時は半角に統一）
                  </span>
                </label>
              </div>

              <div className="space-y-2 rounded-xl border border-rp-orange-border bg-rp-orange/60 p-2.5 sm:space-y-4 sm:p-5">
                <label className="block text-sm">
                  <FieldLabel required>参加人数</FieldLabel>
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    placeholder="18"
                    className="mt-1 min-h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:mt-2 sm:min-h-11 sm:py-2.5 sm:text-sm"
                    value={participantCount}
                    onChange={(e) =>
                      setParticipantCount(inputAsciiDigitsOnly(e.target.value))
                    }
                  />
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 sm:mt-1">
                    {RESERVE_PARTICIPANT_COUNT_HINT_JA}
                  </span>
                </label>
                <div className="space-y-1.5 sm:space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      <FieldLabel required>昼食のご注文</FieldLabel>
                    </p>
                    <div className="mt-1 space-y-2 sm:mt-1.5">
                      {RESERVE_LUNCH_ORDER_HELP_LINES_JA.map((line) => (
                        <p
                          key={line}
                          className="text-[15px] leading-relaxed text-zinc-700 sm:text-sm"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  {lunchMenuLoadError ? (
                    <p className="text-sm text-red-700">{lunchMenuLoadError}</p>
                  ) : lunchMenus === null ? (
                    <p className="text-sm text-zinc-500">昼食メニューを読み込み中…</p>
                  ) : lunchMenus.length === 0 ? (
                    <p className="text-sm text-amber-900">
                      現在、昼食メニューを表示できません。時間をおいて再度お試しください。
                    </p>
                  ) : (
                    <div className="space-y-3 sm:space-y-2">
                      <p className="text-sm font-semibold text-zinc-800 sm:text-sm">
                        メニュー・数量入力
                      </p>

                      {/* スマホ: 横スクロールなしのカード（詰まり回避） */}
                      <div className="space-y-3 sm:hidden">
                        {lunchMenus.map((m) => {
                          const raw = qtyByMenuId[m.id] ?? "";
                          const parsed = parseLunchQuantityField(raw);
                          const safeQ = parsed.ok ? parsed.quantity : NaN;
                          const sub =
                            Number.isFinite(safeQ) && safeQ >= 0
                              ? safeQ * m.priceTaxIncluded
                              : NaN;
                          return (
                            <div
                              key={m.id}
                              className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                            >
                              <p className="min-w-0 text-[15px] font-semibold leading-snug text-zinc-900 wrap-break-word">
                                {m.name}
                              </p>
                              {m.description ? (
                                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                                  {m.description}
                                </p>
                              ) : null}
                              <div className="mt-4 space-y-4 text-[15px]">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                  <span className="text-zinc-500">税込単価</span>
                                  <span className="font-medium tabular-nums text-zinc-900">
                                    {formatTaxIncludedYen(m.priceTaxIncluded)}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <span className="block text-sm font-medium text-zinc-600">
                                    数量
                                  </span>
                                  <input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={3}
                                    className="block w-full max-w-[9rem] min-h-11 rounded-xl border border-zinc-200 px-3 py-2 text-center text-base tabular-nums outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20"
                                    value={raw}
                                    onChange={(e) => {
                                      const v = inputAsciiDigitsOnly(e.target.value).slice(
                                        0,
                                        LUNCH_MENU_QTY_MAX_DIGITS
                                      );
                                      setQtyByMenuId((prev) => ({ ...prev, [m.id]: v }));
                                    }}
                                    aria-label={`${m.name} の数量`}
                                  />
                                </div>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-zinc-100 pt-4">
                                  <span className="text-zinc-500">小計（税込）</span>
                                  <span className="text-base font-semibold tabular-nums text-zinc-900">
                                    {Number.isFinite(sub)
                                      ? formatTaxIncludedYen(sub)
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {lunchMenus.length > 1 ? (
                          <div className="rounded-xl border border-rp-mint-2 bg-rp-mint/50 px-4 py-3">
                            <p className="text-xs font-medium text-zinc-600">昼食合計（税込）</p>
                            <p className="mt-1 text-lg font-bold tabular-nums text-rp-brand">
                              {formatTaxIncludedYen(
                                lunchMenus.reduce((sum, m) => {
                                  const p = parseLunchQuantityField(qtyByMenuId[m.id]);
                                  if (!p.ok) return sum;
                                  return sum + p.quantity * m.priceTaxIncluded;
                                }, 0)
                              )}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* PC: 表形式 */}
                      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white sm:block">
                        <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                              <th className="px-2.5 py-1.5 sm:px-3 sm:py-2">メニュー</th>
                              <th className="px-2.5 py-1.5 sm:px-3 sm:py-2 whitespace-nowrap">
                                税込単価
                              </th>
                              <th className="px-2.5 py-1.5 text-right sm:px-3 sm:py-2 whitespace-nowrap">
                                数量
                              </th>
                              <th className="px-2.5 py-1.5 text-right sm:px-3 sm:py-2 whitespace-nowrap">
                                小計
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lunchMenus.map((m) => {
                              const raw = qtyByMenuId[m.id] ?? "";
                              const parsed = parseLunchQuantityField(raw);
                              const safeQ = parsed.ok ? parsed.quantity : NaN;
                              const sub =
                                Number.isFinite(safeQ) && safeQ >= 0
                                  ? safeQ * m.priceTaxIncluded
                                  : NaN;
                              return (
                                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                                  <td className="px-2.5 py-1.5 align-top sm:px-3 sm:py-2">
                                    <div className="font-medium text-zinc-900">{m.name}</div>
                                    {m.description ? (
                                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                                        {m.description}
                                      </p>
                                    ) : null}
                                  </td>
                                  <td className="px-2.5 py-1.5 align-top tabular-nums text-zinc-800 sm:px-3 sm:py-2">
                                    {formatTaxIncludedYen(m.priceTaxIncluded)}
                                  </td>
                                  <td className="px-2.5 py-1.5 align-top text-right sm:px-3 sm:py-2">
                                    <input
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={3}
                                      className="ml-auto block w-16 min-h-8 rounded-lg border border-zinc-200 px-2 py-1 text-center text-base tabular-nums outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:min-h-9 sm:py-1.5 sm:text-sm"
                                      value={raw}
                                      onChange={(e) => {
                                        const v = inputAsciiDigitsOnly(e.target.value).slice(
                                          0,
                                          LUNCH_MENU_QTY_MAX_DIGITS
                                        );
                                        setQtyByMenuId((prev) => ({ ...prev, [m.id]: v }));
                                      }}
                                      aria-label={`${m.name} の数量`}
                                    />
                                  </td>
                                  <td className="px-2.5 py-1.5 align-top text-right font-semibold tabular-nums text-zinc-900 sm:px-3 sm:py-2">
                                    {Number.isFinite(sub)
                                      ? formatTaxIncludedYen(sub)
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {lunchMenus.length > 1 ? (
                            <tfoot>
                              <tr className="bg-rp-mint/40">
                                <td
                                  colSpan={3}
                                  className="px-2.5 py-1.5 text-right text-sm font-bold text-rp-navy sm:px-3 sm:py-2"
                                >
                                  昼食合計（税込）
                                </td>
                                <td className="px-2.5 py-1.5 text-right text-sm font-bold tabular-nums text-rp-brand sm:px-3 sm:py-2">
                                  {formatTaxIncludedYen(
                                    lunchMenus.reduce((sum, m) => {
                                      const p = parseLunchQuantityField(qtyByMenuId[m.id]);
                                      if (!p.ok) return sum;
                                      return sum + p.quantity * m.priceTaxIncluded;
                                    }, 0)
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          ) : null}
                        </table>
                      </div>
                    </div>
                  )}
                  <LunchPaymentNote className="text-[15px] sm:text-sm" />
                </div>
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-[15px] leading-relaxed text-amber-950 sm:px-3 sm:py-3 sm:text-sm">
                  <p className="font-semibold text-amber-900">昼食について</p>
                  <p className="mt-1 sm:mt-1.5">
                    会場外への飲食の持ち出しはできません。
                  </p>
                </div>
              </div>
            </div>

            {submitError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2.5 pt-0.5 sm:flex-row sm:justify-end sm:gap-3 sm:pt-0">
              <button
                type="submit"
                disabled={submitting || !showReserveForm}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-base font-semibold text-white shadow-md transition-colors hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:min-h-12 sm:min-w-56 sm:px-8 sm:w-auto"
              >
                {submitting ? <InlineSpinner variant="onDark" /> : null}
                {submitting ? "送信中…" : "入力内容を確認する"}
                {!submitting ? (
                  <IconArrowRight className="h-5 w-5 shrink-0" />
                ) : null}
              </button>
            </div>
          </form>
          </div>
        </>
      )}

      {data && phase === "confirm" && (
        <section
          aria-labelledby="reserve-confirm-heading"
          className="space-y-3 rounded-2xl border-2 border-rp-brand/25 bg-white p-4 shadow-md sm:space-y-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="reserve-confirm-heading"
                className="text-lg font-bold text-rp-navy sm:text-xl"
              >
                ご入力内容の確認
              </h2>
              <p className="mt-1 text-xs leading-snug text-zinc-600 sm:text-sm sm:leading-normal">
                内容をご確認のうえ、問題なければ登録してください。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("edit")}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 sm:py-2 sm:text-sm"
            >
              内容を修正する
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-sm md:grid-cols-2">
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">ご利用日</dt>
              <dd className="font-semibold text-zinc-900">
                {formatIsoDateWithWeekdayJa(eventDate)}
              </dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">対象学年帯</dt>
              <dd className="font-semibold text-zinc-900">{gradeBandLabelJa(data.gradeBand)}</dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">午前の枠</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">
                {selectedMorningSlot
                  ? `${selectedMorningSlot.startTime?.slice(0, 5) ?? ""}–${selectedMorningSlot.endTime?.slice(0, 5) ?? ""}`
                  : "—"}
              </dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">チーム名</dt>
              <dd className="wrap-break-word font-medium text-zinc-900">{teamName.trim()}</dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">カテゴリ</dt>
              <dd className="font-medium text-zinc-900">{strengthLabel}</dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">代表学年</dt>
              <dd className="font-medium text-zinc-900">
                {gradeYearLabelJa(parseInt(representativeGradeYear, 10))}
              </dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">チーム代表者名</dt>
              <dd className="wrap-break-word font-medium text-zinc-900">{contactName.trim()}</dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">メール</dt>
              <dd className="wrap-break-word text-zinc-900">{contactEmail.trim()}</dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">電話</dt>
              <dd className="font-mono tabular-nums text-zinc-900">
                {normalizeContactPhoneDigits(contactPhone)}
              </dd>
            </div>
            <div className="grid gap-1 bg-zinc-50/60 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">参加人数</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{participantCount.trim()}名</dd>
            </div>
          </dl>

          {lunchMenus && lunchMenus.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 sm:px-5">
              <p className="text-xs font-semibold text-zinc-600">昼食のご注文</p>
              <ul className="mt-2 space-y-1.5 text-sm text-zinc-800">
                {lunchMenus.map((m) => {
                  const p = parseLunchQuantityField(qtyByMenuId[m.id] ?? "");
                  const q = p.ok ? p.quantity : 0;
                  if (q <= 0) return null;
                  return (
                    <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-1.5 last:border-0">
                      <span className="min-w-0 wrap-break-word font-medium">{m.name}</span>
                      <span className="shrink-0 tabular-nums text-zinc-700">
                        {q}食 × {formatTaxIncludedYen(m.priceTaxIncluded)} ={" "}
                        {formatTaxIncludedYen(q * m.priceTaxIncluded)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 border-t border-zinc-100 pt-2 text-right text-sm font-bold text-rp-brand">
                税込合計{" "}
                {formatTaxIncludedYen(
                  lunchMenus.reduce((sum, m) => {
                    const p = parseLunchQuantityField(qtyByMenuId[m.id] ?? "");
                    if (!p.ok) return sum;
                    return sum + p.quantity * m.priceTaxIncluded;
                  }, 0)
                )}
              </p>
            </div>
          ) : null}

          {submitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting || !data.acceptingReservations}
              onClick={() => void performSubmit()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-8 text-base font-semibold text-white shadow-md transition-colors hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:min-w-56 sm:w-auto"
            >
              {submitting ? <InlineSpinner variant="onDark" /> : null}
              {submitting ? "登録中…" : "この内容で登録する"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
