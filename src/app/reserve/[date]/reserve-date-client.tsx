"use client";

/** SCR-01: 指定日の午前枠選択＋予約フォーム → SCR-02 へ sessionStorage で遷移。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FieldLabel } from "../_components/field-label";
import { LunchPaymentNote } from "../_components/lunch-payment-note";
import { MorningSlotsSelect } from "../_components/morning-slots-select";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconClipboard,
  IconLock,
} from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
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
import { RESERVE_STRENGTH_OPTIONS } from "@/lib/reservations/strength-labels";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";

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

const PM_DISPLAY_SLOTS = [
  { start: "13:30", end: "14:30" },
  { start: "14:30", end: "15:30" },
  { start: "15:30", end: "16:30" },
] as const;

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
  const [contactPhone, setContactPhone] = useState("");
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
            message:
              typeof json.error === "string" && json.error.trim()
                ? json.error
                : `空き状況を取得できませんでした（${res.status}）`,
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
        setLoadIssue({ kind: "error", message: "通信に失敗しました" });
      });
    return () => {
      cancelled = true;
    };
  }, [eventDate, initialMorningSlotId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lunch-menu")
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
            typeof j.error === "string" && j.error.trim()
              ? j.error
              : "昼食メニューを取得できませんでした"
          );
          return;
        }
        setLunchMenuLoadError(null);
        const items = Array.isArray(j.items) ? j.items : [];
        setLunchMenus(items);
        if (items.length === 1) {
          setQtyByMenuId({ [items[0].id]: "16" });
        } else {
          setQtyByMenuId(Object.fromEntries(items.map((m) => [m.id, "0"])));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLunchMenus([]);
        setLunchMenuLoadError("昼食メニューの取得に失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

  const gradeYearChoices = useMemo(
    () => (data ? representativeGradeYearChoicesForBand(data.gradeBand) : []),
    [data]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!data?.eventDayId) {
      setSubmitError("開催日情報がありません");
      return;
    }
    if (!selectedSlotId) {
      setSubmitError("午前の枠を選んでください");
      return;
    }
    const pc = parseInt(participantCount, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      setSubmitError("参加人数は 1 以上の整数にしてください");
      return;
    }
    if (!lunchMenus || lunchMenus.length === 0) {
      setSubmitError("昼食メニューを読み込めていません。しばらくしてから再度お試しください");
      return;
    }
    const lunchItems: { menuItemId: string; quantity: number }[] = [];
    for (const m of lunchMenus) {
      const raw = qtyByMenuId[m.id] ?? "0";
      const q = parseInt(raw, 10);
      if (!Number.isInteger(q) || q < 0 || q > 500) {
        setSubmitError("昼食の数量は 0〜500 の整数にしてください");
        return;
      }
      lunchItems.push({ menuItemId: m.id, quantity: q });
    }
    if (
      !teamName.trim() ||
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactPhone.trim()
    ) {
      setSubmitError("チーム名・チーム代表者名・メール・電話は必須です");
      return;
    }
    if (!["strong", "potential"].includes(strengthCategory)) {
      setSubmitError("チームカテゴリを選んでください");
      return;
    }
    const gy = parseInt(representativeGradeYear, 10);
    if (
      !Number.isInteger(gy) ||
      !gradeYearChoices.includes(gy)
    ) {
      setSubmitError("代表学年を選んでください");
      return;
    }
    const phoneDigits = normalizeContactPhoneDigits(contactPhone);
    if (!isContactPhoneDigitsValid(phoneDigits)) {
      setSubmitError(
        "電話番号は数字のみ、10〜15桁で入力してください（ハイフンは不要です）"
      );
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDayId: data.eventDayId,
        selectedMorningSlotId: selectedSlotId,
        team: {
          teamName: teamName.trim(),
          strengthCategory,
          representativeGradeYear: gy,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: phoneDigits,
        },
        participantCount: pc,
        lunchItems,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      reservationId?: string;
      reservationToken?: string;
    };
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(json.detail ?? json.error ?? `送信に失敗しました（${res.status}）`);
      return;
    }
    if (!json.reservationToken || !json.reservationId) {
      setSubmitError("予約は完了したが表示用データが返りませんでした。運営へ連絡してください。");
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
      setSubmitError("ブラウザの保存領域に書き込めませんでした。別ブラウザでお試しください。");
      return;
    }

    router.push("/reserve/complete");
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <ReserveStepper current={3} />

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconCalendar className="h-6 w-6 sm:h-6 sm:w-6" strokeWidth={1.65} />}
          textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
        >
          {formatIsoDateWithWeekdayJa(eventDate)} の予約
        </ReserveHeadingWithIcon>
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

      {data && (
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
                開催日の2日前15:00締切後、16:30に登録メールアドレス宛へお送りします。午前1試合・午後1試合を原則としています。
              </p>
              <ul className="mt-4 space-y-2">
                {PM_DISPLAY_SLOTS.map((slot) => (
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
            onSubmit={handleSubmit}
            className={`space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8 ${!data.acceptingReservations ? "hidden" : ""}`}
            aria-hidden={!data.acceptingReservations}
          >
            <ReserveHeadingWithIcon
              as="h2"
              shell="navy"
              icon={<IconClipboard className="h-5 w-5 sm:h-6 sm:w-6" />}
              textClassName="text-lg font-bold text-rp-navy"
            >
              予約情報の入力
            </ReserveHeadingWithIcon>

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
                </label>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    <FieldLabel required>昼食のご注文</FieldLabel>
                  </p>
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
                            const raw = qtyByMenuId[m.id] ?? "0";
                            const q = parseInt(raw, 10);
                            const safeQ =
                              Number.isInteger(q) && q >= 0 && q <= 500 ? q : NaN;
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
                                    required
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
                                  const raw = qtyByMenuId[m.id] ?? "0";
                                  const q = parseInt(raw, 10);
                                  if (!Number.isInteger(q) || q < 0) return sum;
                                  return sum + q * m.priceTaxIncluded;
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
                    <li>昼食未申込の場合は会場カフェの利用などに切り替えられることがあります。</li>
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
                {submitting ? "送信中…" : "予約を確認する"}
                {!submitting ? (
                  <IconArrowRight className="h-5 w-5 shrink-0" />
                ) : null}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
