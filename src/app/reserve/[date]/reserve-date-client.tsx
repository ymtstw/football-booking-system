"use client";

/** SCR-01: 指定日の午前枠選択＋予約フォーム → SCR-02 へ sessionStorage で遷移。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FieldLabel } from "../_components/field-label";
import { LunchPaymentNote } from "../_components/lunch-payment-note";
import { MorningSlotsSelect } from "../_components/morning-slots-select";
import { IconArrowLeft, IconArrowRight, IconLock } from "../_components/reserve-icons";
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
import { parseLunchQuantityField } from "@/lib/lunch/parse-lunch-qty-field";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";
import { getDefaultSlotDisplayIntervalsForPhase } from "@/domains/event-days/default-slots";
import {
  RESERVE_LUNCH_ORDER_HELP_JA,
  RESERVE_PARTICIPANT_COUNT_HINT_JA,
} from "@/lib/copy/reserve-participant-lunch-hints";
import {
  RESERVE_MAIL_PUBLIC_JA,
  RESERVE_MAIL_TIMING_NOTE_JA,
} from "@/lib/copy/reserve-public-mail-schedule";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";

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
      return { ok: false, message: "午前の枠を選んでください" };
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
        return {
          ok: false,
          message:
            "昼食の数量は 0〜500 の半角数字で入力してください。不要なメニューは空白のままで構いません。",
          alert:
            "昼食の数量は 0〜500 の半角数字で入力してください。不要なメニューは空白のままで構いません。",
        };
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
      if (!json.reservationToken || !json.reservationId) {
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <ReserveStepper current={phase === "confirm" ? 3 : 2} />

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-rp-navy sm:text-2xl">
          {formatIsoDateWithWeekdayJa(eventDate)} の予約
        </h1>
        {data && (
          <div className="mt-5 grid gap-4 rounded-xl border border-rp-mint-2 bg-rp-mint/50 p-4 sm:grid-cols-3 sm:p-5">
            <div>
              <p className="text-xs font-medium text-zinc-500">ご希望日</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {formatIsoDateWithWeekdayJa(eventDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">対象学年帯</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {gradeBandLabelJa(data.gradeBand)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">予約締切</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                {formatDateTimeTokyoWithWeekday(data.reservationDeadlineAt)}
              </p>
            </div>
          </div>
        )}
      </div>

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
          <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
            <MorningSlotsSelect
              morningSlots={data.morningSlots}
              acceptingReservations={data.acceptingReservations}
              eventDayStatus={data.eventDayStatus}
              selectedSlotId={selectedSlotId}
              onSelectSlot={setSelectedSlotId}
              subheading="チームにつき 1 枠をお選びください。予約済みチームの学年・カテゴリを参考にできます。"
              variant="full"
            />

            <section className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 sm:p-5">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-zinc-700">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200/80 text-zinc-600 ring-1 ring-zinc-300/80">
                  <IconLock className="h-5 w-5" />
                </span>
                午後の対戦枠（選択不可・調整中）
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 sm:text-sm">
                開催日の2日前15:00が予約締切です。締切後、午後の対戦枠案内メールは締切日の
                {RESERVE_MAIL_PUBLIC_JA.matchingBy}（日本時間）までにお届けする予定です。送信処理は
                {RESERVE_MAIL_PUBLIC_JA.matchingCronHint}を目安に開始します。午前1試合・午後1試合を原則としています。
                {RESERVE_MAIL_TIMING_NOTE_JA}
              </p>
              <p className="mt-3 rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-xs leading-relaxed text-zinc-700">
                午後の例は運営の標準テンプレに基づく<strong className="font-semibold text-zinc-900">40分刻み</strong>
                です。<strong className="font-semibold text-zinc-900">12:00–13:00は昼休憩</strong>
                のため枠を置きません（実際の割当は締切後の編成で確定します）。
              </p>
              <ul className="mt-4 space-y-2">
                {getDefaultSlotDisplayIntervalsForPhase("afternoon").map((slot) => (
                  <li
                    key={`${slot.start}-${slot.end}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/80 px-3 py-3 text-sm text-zinc-500"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                      <IconLock className="h-5 w-5 opacity-80" />
                    </span>
                    <span className="font-medium tabular-nums">
                      {slot.start}–{slot.end}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <form
            onSubmit={handleGoToConfirm}
            className={`space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8 ${!data.acceptingReservations ? "hidden" : ""}`}
            aria-hidden={!data.acceptingReservations}
          >
            <h2 className="text-lg font-bold text-rp-navy">予約情報の入力</h2>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-4 rounded-xl border border-sky-200/70 bg-sky-50/50 p-4 sm:p-5">
                <label className="block text-sm">
                  <FieldLabel required>チーム名</FieldLabel>
                  <input
                    required
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none ring-rp-brand/20 focus:border-rp-brand focus:ring-2 sm:text-sm"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    autoComplete="organization"
                    placeholder="例：○○サッカークラブ"
                  />
                </label>
                <div className="rounded-xl border border-rp-mint-2 bg-rp-mint/60 px-3 py-2.5 text-xs leading-relaxed text-zinc-800 sm:text-sm">
                  <p className="font-semibold text-rp-brand">カテゴリについて</p>
                  <ul className="mt-1 space-y-1">
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
                <label className="block text-sm">
                  <FieldLabel required>カテゴリを選択</FieldLabel>
                  <select
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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
                <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-xs text-zinc-700">
                  <p className="font-medium text-zinc-900">代表学年</p>
                  <p className="mt-1">
                    複数学年が混ざる場合は、
                    <span className="font-semibold">人数が多い方の学年</span>
                    を選んでください。
                  </p>
                </div>
                <label className="block text-sm">
                  <FieldLabel required>代表学年を選択</FieldLabel>
                  <select
                    required
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                    value={representativeGradeYear}
                    onChange={(e) => setRepresentativeGradeYear(e.target.value)}
                  >
                    {gradeYearChoices.map((y) => (
                      <option key={y} value={String(y)}>
                        {gradeYearLabelJa(y)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <FieldLabel required>チーム代表者名</FieldLabel>
                  <input
                    required
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                    value={contactEmailConfirm}
                    onChange={(e) => setContactEmailConfirm(e.target.value)}
                    autoComplete="off"
                    placeholder="上と同じメールを再入力"
                  />
                  <span className="mt-1 block text-xs text-zinc-500">
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
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                    value={contactPhone}
                    onChange={(e) =>
                      setContactPhone(normalizeContactPhoneDigits(e.target.value))
                    }
                    autoComplete="tel"
                  />
                  <span className="mt-1 block text-xs text-zinc-500">
                    10〜15 桁・ハイフン不要（保存時は半角に統一）
                  </span>
                </label>
              </div>

              <div className="space-y-4 rounded-xl border border-rp-orange-border bg-rp-orange/60 p-4 sm:p-5">
                <label className="block text-sm">
                  <FieldLabel required>参加人数</FieldLabel>
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="18"
                    className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                    value={participantCount}
                    onChange={(e) =>
                      setParticipantCount(inputAsciiDigitsOnly(e.target.value))
                    }
                  />
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                    {RESERVE_PARTICIPANT_COUNT_HINT_JA}
                  </span>
                </label>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      <FieldLabel required>昼食のご注文</FieldLabel>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                      {RESERVE_LUNCH_ORDER_HELP_JA}
                    </p>
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
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                      <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                            <th className="px-3 py-2">メニュー</th>
                            <th className="px-3 py-2 whitespace-nowrap">税込単価</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">数量</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">小計</th>
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
                                <td className="px-3 py-2 align-top">
                                  <div className="font-medium text-zinc-900">{m.name}</div>
                                  {m.description ? (
                                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                                      {m.description}
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 align-top tabular-nums text-zinc-800">
                                  {formatTaxIncludedYen(m.priceTaxIncluded)}
                                </td>
                                <td className="px-3 py-2 align-top text-right">
                                  <input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={3}
                                    className="ml-auto block w-16 min-h-9 rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-base tabular-nums outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                                    value={raw}
                                    onChange={(e) => {
                                      const v = inputAsciiDigitsOnly(e.target.value);
                                      setQtyByMenuId((prev) => ({ ...prev, [m.id]: v }));
                                    }}
                                    aria-label={`${m.name} の数量`}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top text-right font-semibold tabular-nums text-zinc-900">
                                  {Number.isFinite(sub)
                                    ? formatTaxIncludedYen(sub)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-rp-mint/40">
                            <td colSpan={3} className="px-3 py-2 text-right text-sm font-bold text-rp-navy">
                              昼食合計（税込）
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-rp-brand">
                              {formatTaxIncludedYen(
                                lunchMenus.reduce((sum, m) => {
                                  const p = parseLunchQuantityField(
                                    qtyByMenuId[m.id]
                                  );
                                  if (!p.ok) return sum;
                                  return sum + p.quantity * m.priceTaxIncluded;
                                }, 0)
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  <LunchPaymentNote />
                </div>
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-xs leading-relaxed text-amber-950 sm:text-sm">
                  <p className="font-semibold text-amber-900">昼食について</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>会場外への飲食の持ち出しはできません。</li>
                    <li>上記の数量はこの場で確定します。お支払いは当日、代表者の方にてまとめてお願いします。</li>
                  </ul>
                </div>
              </div>
            </div>

            {submitError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-4">
              <Link
                href="/reserve/calendar"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-rp-brand bg-white px-6 text-base font-semibold text-rp-brand hover:bg-rp-mint/50 sm:order-1 sm:w-auto"
              >
                <IconArrowLeft className="h-5 w-5 shrink-0" />
                開催日選択へ戻る
              </Link>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !data.acceptingReservations ||
                  data.morningSlots.every((s) => !s.bookable)
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-8 text-base font-semibold text-white shadow-md transition-colors hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:order-2 sm:min-w-56 sm:w-auto"
              >
                {submitting ? <InlineSpinner variant="onDark" /> : null}
                {submitting ? "送信中…" : "入力内容を確認する"}
                {!submitting ? (
                  <IconArrowRight className="h-5 w-5 shrink-0" />
                ) : null}
              </button>
            </div>
          </form>
        </>
      )}

      {data && phase === "confirm" && (
        <section
          aria-labelledby="reserve-confirm-heading"
          className="space-y-6 rounded-2xl border-2 border-rp-brand/25 bg-white p-5 shadow-md sm:p-8"
        >
          <h2 id="reserve-confirm-heading" className="text-lg font-bold text-rp-navy sm:text-xl">
            ご入力内容の確認
          </h2>
          <p className="text-sm leading-relaxed text-zinc-700">
            誤入力がないかご確認ください。修正する場合は「入力に戻る」、問題なければ「この内容で登録する」を押してください。
          </p>
          <p className="rounded-xl border border-rp-mint-2 bg-rp-mint/60 px-4 py-3.5 text-center text-base font-semibold text-rp-navy sm:text-lg">
            この内容で登録してもよろしいでしょうか？
          </p>

          <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-zinc-50/60 text-sm">
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">ご利用日</dt>
              <dd className="font-semibold text-zinc-900">
                {formatIsoDateWithWeekdayJa(eventDate)}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">対象学年帯</dt>
              <dd className="font-semibold text-zinc-900">{gradeBandLabelJa(data.gradeBand)}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">午前の枠</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">
                {selectedMorningSlot
                  ? `${selectedMorningSlot.startTime?.slice(0, 5) ?? ""}–${selectedMorningSlot.endTime?.slice(0, 5) ?? ""}`
                  : "—"}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">チーム名</dt>
              <dd className="wrap-break-word font-medium text-zinc-900">{teamName.trim()}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">カテゴリ</dt>
              <dd className="font-medium text-zinc-900">{strengthLabel}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">代表学年</dt>
              <dd className="font-medium text-zinc-900">
                {gradeYearLabelJa(parseInt(representativeGradeYear, 10))}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">チーム代表者名</dt>
              <dd className="wrap-break-word font-medium text-zinc-900">{contactName.trim()}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">メール</dt>
              <dd className="wrap-break-word text-zinc-900">{contactEmail.trim()}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">電話</dt>
              <dd className="font-mono tabular-nums text-zinc-900">
                {normalizeContactPhoneDigits(contactPhone)}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:px-5">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-4">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setSubmitError(null);
                setPhase("edit");
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-rp-brand bg-white px-6 text-base font-semibold text-rp-brand hover:bg-rp-mint/50 disabled:opacity-50 sm:order-1 sm:w-auto"
            >
              <IconArrowLeft className="h-5 w-5 shrink-0" />
              入力に戻る
            </button>
            <button
              type="button"
              disabled={submitting || !data.acceptingReservations}
              onClick={() => void performSubmit()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-8 text-base font-semibold text-white shadow-md transition-colors hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:order-2 sm:min-w-56 sm:w-auto"
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
