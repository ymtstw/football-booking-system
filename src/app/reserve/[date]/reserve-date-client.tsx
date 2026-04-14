"use client";

/** SCR-01: 指定日の午前枠選択＋予約フォーム → SCR-02 へ sessionStorage で遷移。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  RESERVE_STRENGTH_OPTIONS,
  strengthCategoryLabelJa,
} from "@/lib/reservations/strength-labels";

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

function formatHm(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

type AvailabilityLoadIssue =
  | null
  /** 公開中の開催日が無い（404）。DB リセット直後・未公開・ブックマークの古い日付など */
  | { kind: "no_open_day" }
  /** 5xx や想定外の 4xx、通信失敗 */
  | { kind: "error"; message: string };

export function ReserveDateClient({ eventDate }: { eventDate: string }) {
  const router = useRouter();
  const [data, setData] = useState<AvailabilityJson | null>(null);
  const [loadIssue, setLoadIssue] = useState<AvailabilityLoadIssue>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [strengthCategory, setStrengthCategory] = useState<string>("strong");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [participantCount, setParticipantCount] = useState("18");
  const [mealCount, setMealCount] = useState("16");
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
        setSelectedSlotId("");
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoadIssue({ kind: "error", message: "通信に失敗しました" });
      });
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

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
    const mc = parseInt(mealCount, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      setSubmitError("参加人数は 1 以上の整数にしてください");
      return;
    }
    if (!Number.isInteger(mc) || mc < 0) {
      setSubmitError("昼食数は 0 以上の整数にしてください");
      return;
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
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: phoneDigits,
        },
        participantCount: pc,
        mealCount: mc,
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
      <div>
        <Link
          href="/reserve"
          className="inline-flex min-h-9 items-center text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← 開催日一覧
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900 sm:text-xl">
          {formatIsoDateWithWeekdayJa(eventDate)} の予約
        </h1>
        {data && (
          <p className="mt-1 break-words text-sm text-zinc-600">
            学年帯: {data.gradeBand} ／ 締切:{" "}
            {formatDateTimeTokyoWithWeekday(data.reservationDeadlineAt)}
          </p>
        )}
      </div>

      {data?.acceptingReservations && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950">
          午前の対戦はこの予約で確定します。午後の試合は前日の自動編成で決まります。
        </p>
      )}

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
              href="/reserve"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-900 px-4 py-2 text-sm font-medium text-white hover:bg-sky-950"
            >
              予約カレンダーへ戻る
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
          <section className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900">
              午前の枠を選択してください
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700">
              <li>
                <span className="font-medium text-zinc-900">ハイレベル</span>
                ：経験が多く試合に慣れているチーム
              </li>
              <li>
                <span className="font-medium text-zinc-900">ポテンシャル</span>
                ：これから成長していくチーム
              </li>
            </ul>
            {!data.acceptingReservations && (
              <p className="mt-3 text-sm text-red-700">
                {data.eventDayStatus === "cancelled_weather"
                  ? "雨天のため開催中止です。新規の予約はできません。"
                  : data.eventDayStatus === "cancelled_minimum"
                    ? "最少催行に満たないため開催中止です。新規の予約はできません。"
                    : data.eventDayStatus === "confirmed"
                      ? "編成が確定済みのため、新規の予約はできません。"
                      : data.eventDayStatus === "locked"
                        ? "締切後のため、新規の予約はできません。"
                        : "予約締切を過ぎているため、新規の予約はできません。"}
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {data.morningSlots.map((s) => {
                const disabled = !s.bookable || !data.acceptingReservations;
                const teams = s.bookedTeams ?? [];
                const remain = Math.max(0, s.capacity - s.activeCount);
                const slotHeadline = s.full
                  ? `${formatHm(s.startTime)}–${formatHm(s.endTime)}（満席）`
                  : `${formatHm(s.startTime)}–${formatHm(s.endTime)}（残り${remain}枠）`;
                return (
                  <li key={s.id}>
                    <label
                      className={`flex min-h-[3.25rem] cursor-pointer items-start gap-3 rounded-lg border p-3.5 sm:p-3 ${
                        disabled
                          ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                          : selectedSlotId === s.id
                            ? "border-zinc-900 bg-white"
                            : "border-zinc-200 bg-white hover:border-zinc-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={s.id}
                        className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 sm:mt-1 sm:h-4 sm:w-4"
                        checked={selectedSlotId === s.id}
                        disabled={disabled}
                        onChange={() => setSelectedSlotId(s.id)}
                      />
                      <div className="min-w-0 flex-1 space-y-2 text-sm">
                        <div className="font-medium text-zinc-900">
                          {slotHeadline}
                          {s.isLocked && " ・ロック中"}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-500">
                            この枠の予約済みチーム
                          </p>
                          {teams.length === 0 ? (
                            <p className="mt-1 text-zinc-500">なし</p>
                          ) : (
                            <ul className="mt-1 space-y-0.5 text-sm text-zinc-800">
                              {teams.map((t) => (
                                <li key={t.reservationId}>
                                  {t.teamName}:
                                  {strengthCategoryLabelJa(t.strengthCategory)}
                                </li>
                              ))}
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

          <form
            onSubmit={handleSubmit}
            className={`space-y-4 ${!data.acceptingReservations ? "hidden" : ""}`}
            aria-hidden={!data.acceptingReservations}
          >
            <h2 className="text-sm font-semibold text-zinc-800">チーム・連絡先</h2>
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-4">
              <label className="block text-sm">
                <span className="text-zinc-700">チーム名</span>
                <input
                  required
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoComplete="organization"
                />
              </label>
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm leading-relaxed text-sky-950">
                <p className="font-medium">カテゴリ</p>
                <ul className="mt-1 space-y-0.5 text-xs leading-snug">
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
                <span className="text-zinc-700">カテゴリを選択</span>
                <select
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-base text-zinc-900 sm:text-sm"
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
                <span className="text-zinc-700">チーム代表者名</span>
                <input
                  required
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoComplete="name"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  姓・ニックネーム・略称など、運営から呼びかけやすい名前で構いません。
                </span>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700">メール</span>
                <input
                  required
                  type="email"
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700">電話（数字のみ）</span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  placeholder="09012345678"
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={contactPhone}
                  onChange={(e) =>
                    setContactPhone(normalizeContactPhoneDigits(e.target.value))
                  }
                  autoComplete="tel"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  半角・全角の数字どちらでも入力できます（保存時は半角に統一）。ハイフンは不要です（10〜15桁）。
                </span>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700">参加人数（帯同含む・数字のみ）</span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="18"
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={participantCount}
                  onChange={(e) =>
                    setParticipantCount(inputAsciiDigitsOnly(e.target.value))
                  }
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  半角・全角の数字で入力できます（保存時は半角）。1 以上の整数。
                </span>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-700">昼食数（数字のみ）</span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="16"
                  className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                  value={mealCount}
                  onChange={(e) =>
                    setMealCount(inputAsciiDigitsOnly(e.target.value))
                  }
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  半角・全角の数字で入力できます（保存時は半角）。0 以上の整数。
                </span>
              </label>
            </div>

            {submitError && (
              <p className="text-sm text-red-700">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                !data.acceptingReservations ||
                data.morningSlots.every((s) => !s.bookable)
              }
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white disabled:cursor-wait disabled:bg-zinc-400 sm:text-sm"
            >
              {submitting ? <InlineSpinner variant="onDark" /> : null}
              {submitting ? "送信中…" : "予約を確定する"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
