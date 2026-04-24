"use client";

/**
 * 予約詳細（確認コードは sessionStorage）。編集・キャンセルはこの画面のみ。
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { LunchOrderSummary } from "../../_components/lunch-order-summary";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  RESERVE_LUNCH_ORDER_HELP_JA,
  RESERVE_PARTICIPANT_COUNT_HINT_JA,
} from "@/lib/copy/reserve-participant-lunch-hints";
import { RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA } from "@/lib/copy/reserve-public-mail-schedule";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import type { LunchMenuItemPublic, ReservationLunchLinePublic } from "@/lib/lunch/types";
import {
  LUNCH_MENU_QTY_MAX_DIGITS,
  LUNCH_MENU_QTY_PARSE_HELP_JA,
  parseLunchQuantityField,
} from "@/lib/lunch/parse-lunch-qty-field";
import { formatJpyInteger, formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import { MANAGE_VIEW_TOKEN_SESSION_KEY } from "@/lib/reserve/manage-view-session";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import {
  isAtLeastFourDigitCount,
  RESERVE_COUNT_MAX_ALLOWED,
  RESERVE_COUNT_REJECT_FROM,
} from "@/lib/reservations/reserve-numeric-sanity";
import {
  isValidReservationTokenFormat,
  normalizeReservationTokenPlain,
} from "@/lib/reservations/token-format";
import {
  isContactPhoneDigitsValid,
  normalizeContactPhoneDigits,
} from "@/lib/validators/contact-phone";
import { inputAsciiDigitsOnly } from "@/lib/validators/digits-input";
import {
  isReserveContactNameOk,
  RESERVE_CONTACT_NAME_MAX_CHARS,
} from "@/lib/validators/reserve-contact-name";

type ReservationJson = {
  reservation?: {
    id: string;
    status: string;
    participantCount: number;
    lunchItems: ReservationLunchLinePublic[];
    lunchTotalTaxIncluded: number;
    createdAt: string;
    eventDay: {
      id: string;
      eventDate: string;
      gradeBand: string;
      status: string;
      reservationDeadlineAt: string;
    };
    morningSlot: {
      id: string;
      slotCode: string;
      startTime: string;
      endTime: string;
      phase: string;
    } | null;
    team: {
      teamName: string;
      strengthCategory: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
    };
  };
  error?: string;
};

function formatHm(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function gradeBandLabelJa(band: string): string {
  const g = band.trim();
  if (g === "1-2") return "1〜2年生";
  if (g === "3-4") return "3〜4年生";
  if (g === "5-6") return "5〜6年生";
  return g;
}

function isBeforeDeadline(deadlineIso: string): boolean {
  const t = new Date(deadlineIso).getTime();
  return Number.isFinite(t) && Date.now() < t;
}

function statusLabelJa(status: string): string {
  if (status === "cancelled") return "キャンセル済み";
  if (status === "active") return "予約受付中";
  return status;
}

function ReadRow({ label, children: value }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-zinc-100 py-2.5 last:border-b-0 sm:py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium leading-snug text-zinc-900">{value}</p>
    </div>
  );
}

export default function ReserveManageViewPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationJson["reservation"] | null>(null);
  const [loading, setLoading] = useState(false);

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editParticipant, setEditParticipant] = useState("");
  const [lunchMenus, setLunchMenus] = useState<LunchMenuItemPublic[] | null>(null);
  const [editLunchQtyByMenuId, setEditLunchQtyByMenuId] = useState<Record<string, string>>({});
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveNoticeRef = useRef<HTMLDivElement>(null);

  /** 編集フォームの昼食税込合計（いずれかの数量が不正なら表示用は未確定） */
  const editLunchTotalTaxIncluded = useMemo(() => {
    if (!lunchMenus?.length) return null;
    let total = 0;
    for (const m of lunchMenus) {
      const parsed = parseLunchQuantityField(editLunchQtyByMenuId[m.id] ?? "");
      if (!parsed.ok) return { ok: false as const };
      total += parsed.quantity * m.priceTaxIncluded;
    }
    return { ok: true as const, total };
  }, [lunchMenus, editLunchQtyByMenuId]);

  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const clearTokenAndGoInput = useCallback(() => {
    try {
      sessionStorage.removeItem(MANAGE_VIEW_TOKEN_SESSION_KEY);
    } catch {
      /* ignore */
    }
    router.push("/reserve/manage");
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(MANAGE_VIEW_TOKEN_SESSION_KEY);
        const t = raw ? normalizeReservationTokenPlain(raw) : "";
        if (t && isValidReservationTokenFormat(t)) {
          setToken(t);
        } else {
          setToken(null);
        }
      } catch {
        setToken(null);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  const fetchReservation = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`);
      const json = (await res.json().catch(() => ({}))) as ReservationJson;
      if (!res.ok || !json.reservation) {
        setReservation(null);
        setLoadErr(
          reserveFlowApiErrorDisplay(
            res.status,
            typeof json.error === "string" ? json.error : undefined,
            "予約内容の取得に失敗しました"
          )
        );
        return;
      }
      setReservation(json.reservation);
      setLoadErr(null);
    } catch (e) {
      setReservation(null);
      setLoadErr(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    void fetchReservation();
  }, [hydrated, token, fetchReservation]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/reserve/manage");
    }
  }, [hydrated, token, router]);

  useEffect(() => {
    const eventDayId = reservation?.eventDay?.id?.trim();
    if (!eventDayId) {
      setLunchMenus(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/lunch-menu?eventDayId=${encodeURIComponent(eventDayId)}`)
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { items?: LunchMenuItemPublic[] };
        if (cancelled) return;
        setLunchMenus(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {
        if (!cancelled) setLunchMenus([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reservation?.eventDay?.id]);

  useEffect(() => {
    if (!reservation || lunchMenus === null) return;
    queueMicrotask(() => {
      setEditParticipant(String(reservation.participantCount));
      setEditContactName(reservation.team.contactName);
      setEditContactPhone(reservation.team.contactPhone);
      if (lunchMenus.length > 0) {
        const qty: Record<string, string> = {};
        for (const m of lunchMenus) {
          const line = reservation.lunchItems.find((li) => li.menuItemId === m.id);
          const q = line?.quantity ?? 0;
          qty[m.id] = q > 0 ? String(q) : "";
        }
        setEditLunchQtyByMenuId(qty);
      } else {
        setEditLunchQtyByMenuId({});
      }
    });
  }, [reservation, lunchMenus]);

  function dismissSaveFeedback() {
    setSaveOk(null);
    setSaveError(null);
  }

  async function saveEdits() {
    if (!token) return;
    setSaveError(null);
    setSaveOk(null);
    if (!reservation || reservation.status !== "active") {
      setSaveError("変更できる予約がありません");
      return;
    }
    if (reservation.eventDay.status !== "open") {
      setSaveError("受付を終了したため、ここからは変更できません");
      return;
    }
    if (!isBeforeDeadline(reservation.eventDay.reservationDeadlineAt)) {
      setSaveError(
        `${RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}を過ぎているため、ここからは変更できません`
      );
      return;
    }

    const pc = parseInt(editParticipant, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      setSaveError("参加選手数は 1 以上の整数にしてください");
      return;
    }
    if (isAtLeastFourDigitCount(pc)) {
      window.alert(
        `参加選手数が ${RESERVE_COUNT_REJECT_FROM} 以上です。\n誤入力でないかご確認ください。`
      );
      setSaveError(`参加選手数は ${RESERVE_COUNT_MAX_ALLOWED} 以下の整数にしてください。`);
      return;
    }
    if (!lunchMenus?.length) {
      setSaveError("昼食メニューを読み込めていません。しばらくしてから再度お試しください");
      return;
    }
    const lunchItems: { menuItemId: string; quantity: number }[] = [];
    let lunchTotalUnits = 0;
    for (const m of lunchMenus) {
      const parsed = parseLunchQuantityField(editLunchQtyByMenuId[m.id]);
      if (!parsed.ok) {
        setSaveError(`昼食数は ${LUNCH_MENU_QTY_PARSE_HELP_JA}`);
        return;
      }
      lunchItems.push({ menuItemId: m.id, quantity: parsed.quantity });
      lunchTotalUnits += parsed.quantity;
    }
    if (lunchTotalUnits === 0) {
      setSaveError("昼食は、必ずご予約が必要です。");
      return;
    }
    if (isAtLeastFourDigitCount(lunchTotalUnits)) {
      window.alert(
        `昼食の食数の合計が ${RESERVE_COUNT_REJECT_FROM} 以上です。\n誤入力でないかご確認ください。`
      );
      setSaveError(`昼食の食数の合計は ${RESERVE_COUNT_MAX_ALLOWED} 以下にしてください。`);
      return;
    }
    const contactNameTrimmed = editContactName.trim();
    if (!contactNameTrimmed) {
      setSaveError("チーム代表者名を入力してください");
      return;
    }
    if (!isReserveContactNameOk(contactNameTrimmed)) {
      setSaveError(
        `チーム代表者名は${RESERVE_CONTACT_NAME_MAX_CHARS}文字以内で入力してください`
      );
      return;
    }
    const phoneDigits = normalizeContactPhoneDigits(editContactPhone);
    if (!isContactPhoneDigitsValid(phoneDigits)) {
      setSaveError(
        "電話番号は数字のみ、10〜15桁で入力してください（ハイフンは不要です）"
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCount: pc,
          lunchItems,
          contactName: contactNameTrimmed,
          contactPhone: phoneDigits,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        reservation?: ReservationJson["reservation"];
      };

      if (!res.ok) {
        setSaveError(
          reserveFlowApiErrorDisplay(
            res.status,
            typeof json.error === "string" ? json.error : undefined,
            `保存に失敗しました（${res.status}）`
          )
        );
        return;
      }
      if (json.reservation) {
        setReservation(json.reservation);
      } else {
        await fetchReservation({ silent: true });
      }
      setSaveOk("変更を保存しました。");
      setEditFormOpen(false);
      requestAnimationFrame(() => {
        saveNoticeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (e) {
      setSaveError(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (!token) return;
    setCancelMessage(null);
    if (!reservation || reservation.status !== "active") {
      setCancelMessage("キャンセルできる予約がありません");
      return;
    }
    if (reservation.eventDay.status !== "open") {
      setCancelMessage("受付を終了したため、キャンセルできません");
      return;
    }
    const deadline = new Date(reservation.eventDay.reservationDeadlineAt).getTime();
    if (!Number.isFinite(deadline) || Date.now() >= deadline) {
      setCancelMessage(
        `${RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}を過ぎているため、ここからはキャンセルできません`
      );
      return;
    }
    if (
      !window.confirm(
        "この予約をキャンセルしますか？キャンセル後も確認コードで内容を確認できます。"
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${encodeURIComponent(token)}/cancel`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyCancelled?: boolean;
      };
      if (!res.ok) {
        setCancelMessage(
          reserveFlowApiErrorDisplay(
            res.status,
            typeof json.error === "string" ? json.error : undefined,
            `キャンセルに失敗しました（${res.status}）`
          )
        );
        return;
      }
      setCancelMessage(
        json.alreadyCancelled ? "すでにキャンセル済みです" : "キャンセルしました"
      );
      await fetchReservation({ silent: true });
    } catch (e) {
      setCancelMessage(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      setCancelling(false);
    }
  }

  const canMutate =
    reservation &&
    reservation.status === "active" &&
    reservation.eventDay.status === "open" &&
    isBeforeDeadline(reservation.eventDay.reservationDeadlineAt);

  const canEdit = Boolean(canMutate);

  if (!hydrated) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        読み込み中…
      </p>
    );
  }

  if (!token) {
    return null;
  }

  if (loading && !reservation) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
        <InlineSpinner variant="onLight" />
        予約内容を読み込み中…
      </p>
    );
  }

  if (loadErr || !reservation) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadErr ?? "予約を表示できませんでした。"}
        </p>
        <button
          type="button"
          onClick={clearTokenAndGoInput}
          className="text-sm font-semibold text-rp-brand underline underline-offset-2"
        >
          予約確認ページへ
        </button>
      </div>
    );
  }

  const morningLabel = reservation.morningSlot
    ? `${formatHm(reservation.morningSlot.startTime)}〜${formatHm(reservation.morningSlot.endTime)}`
    : "—";

  return (
    <div className="mx-auto w-full max-w-[min(100%,820px)] space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={clearTokenAndGoInput}
          className="text-sm font-semibold text-rp-brand underline underline-offset-2 hover:text-rp-navy"
        >
          ← 予約確認ページへ
        </button>
      </div>

      <header className="space-y-1">
        <h1 className="text-xl font-bold text-rp-navy sm:text-2xl">予約内容</h1>
        <p className="text-sm text-zinc-600">ご登録内容の確認・変更・キャンセルはこの画面で行えます。</p>
      </header>

      <section
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm sm:px-5 sm:py-4"
        aria-labelledby="view-deadline-heading"
      >
        <h2 id="view-deadline-heading" className="font-bold text-amber-900">
          変更・キャンセルの締切
        </h2>
        <p className="mt-2 font-semibold leading-snug">開催日の2日前 15:00（日本時間）まで</p>
        <p className="mt-1.5 leading-relaxed">
          この日時を過ぎると、Webからの変更・キャンセルはできません。
        </p>
      </section>

      <div ref={saveNoticeRef} className="space-y-2">
        {saveOk ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-950"
          >
            {saveOk}
          </div>
        ) : null}
        {saveError ? (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-950">
            {saveError}
          </div>
        ) : null}
      </div>

      {/* 確認専用 */}
      <section
        className="overflow-hidden rounded-2xl border border-rp-mint-2 bg-white shadow-sm"
        aria-labelledby="view-read-heading"
      >
        <div className="border-b border-rp-mint-2 bg-rp-mint/30 px-4 py-3 sm:px-5">
          <h2 id="view-read-heading" className="text-base font-bold text-rp-navy">
            予約の内容
          </h2>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                reservation.status === "cancelled"
                  ? "bg-zinc-200 text-zinc-700"
                  : "bg-rp-brand text-white"
              }`}
            >
              {statusLabelJa(reservation.status)}
            </span>
          </div>
          <div>
            <ReadRow label="利用日">{formatIsoDateWithWeekdayJa(reservation.eventDay.eventDate)}</ReadRow>
            <ReadRow label="対象学年帯">{gradeBandLabelJa(reservation.eventDay.gradeBand)}</ReadRow>
            <ReadRow label="午前の希望枠">{morningLabel}</ReadRow>
            <ReadRow label="チーム名">{reservation.team.teamName}</ReadRow>
            <ReadRow label="代表者名">{reservation.team.contactName}</ReadRow>
            <ReadRow label="メール">
              <span className="break-all">{reservation.team.contactEmail}</span>
            </ReadRow>
            <ReadRow label="電話番号">
              {reservation.team.contactPhone.trim() ? reservation.team.contactPhone : "—"}
            </ReadRow>
            <ReadRow label="参加選手数">{reservation.participantCount}名</ReadRow>
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="text-xs font-medium text-zinc-500">昼食内容</p>
            <div className="mt-2">
              <LunchOrderSummary
                lines={reservation.lunchItems}
                totalTaxIncluded={reservation.lunchTotalTaxIncluded}
              />
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-600">
            変更・キャンセル締切:{" "}
            {formatDateTimeTokyoWithWeekday(reservation.eventDay.reservationDeadlineAt)}
          </p>
        </div>
      </section>

      {/* 編集（開いたときのみ） */}
      {canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 shadow-sm">
          {!editFormOpen ? (
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={() => {
                  dismissSaveFeedback();
                  setEditFormOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border-2 border-rp-brand bg-white px-6 text-sm font-semibold text-rp-brand hover:bg-rp-mint/30 sm:w-auto"
              >
                予約内容を変更する
              </button>
            </div>
          ) : (
            <div className="border-t-4 border-rp-brand/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-rp-navy">予約内容の変更</h2>
                <button
                  type="button"
                  onClick={() => {
                    dismissSaveFeedback();
                    setEditFormOpen(false);
                  }}
                  className="text-sm font-semibold text-zinc-600 underline underline-offset-2 hover:text-rp-navy"
                >
                  閉じる
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                {RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}
                まで、代表者名・電話番号・参加選手数・昼食数を更新できます。
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">チーム代表者名</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    value={editContactName}
                    maxLength={RESERVE_CONTACT_NAME_MAX_CHARS}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditContactName(e.target.value);
                    }}
                    autoComplete="name"
                  />
                </label>
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">電話番号</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    inputMode="numeric"
                    maxLength={15}
                    value={editContactPhone}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditContactPhone(inputAsciiDigitsOnly(e.target.value));
                    }}
                    autoComplete="tel"
                  />
                </label>
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">参加選手数</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={editParticipant}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditParticipant(inputAsciiDigitsOnly(e.target.value));
                    }}
                  />
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                    {RESERVE_PARTICIPANT_COUNT_HINT_JA}
                  </span>
                </label>
                {lunchMenus && lunchMenus.length > 0 ? (
                  <div className="min-w-0 sm:col-span-2 space-y-2">
                    <div>
                      <span className="block text-sm font-medium text-zinc-700">昼食数</span>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        {RESERVE_LUNCH_ORDER_HELP_JA}
                      </p>
                    </div>
                    {/* スマホ: 1メニュー1カード（横スクロールなし） */}
                    <div className="space-y-3 sm:hidden">
                      {lunchMenus.map((m) => {
                        const raw = editLunchQtyByMenuId[m.id] ?? "";
                        const parsed = parseLunchQuantityField(raw);
                        const sub = parsed.ok ? parsed.quantity * m.priceTaxIncluded : NaN;
                        return (
                          <div
                            key={m.id}
                            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                          >
                            <p className="text-sm font-semibold leading-snug text-zinc-900 break-words">
                              {m.name}
                            </p>
                            <div className="mt-3 space-y-3 text-sm">
                              <p className="min-w-0 leading-relaxed">
                                <span className="text-zinc-500">税込単価：</span>
                                <span className="font-medium tabular-nums text-zinc-900">
                                  {formatJpyInteger(m.priceTaxIncluded)}
                                </span>
                              </p>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                                <span className="shrink-0 text-zinc-500">昼食数：</span>
                                <input
                                  className="min-h-11 w-24 shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-center text-base tabular-nums text-zinc-900"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={LUNCH_MENU_QTY_MAX_DIGITS}
                                  value={raw}
                                  onChange={(e) => {
                                    dismissSaveFeedback();
                                    setEditLunchQtyByMenuId((prev) => ({
                                      ...prev,
                                      [m.id]: inputAsciiDigitsOnly(e.target.value).slice(
                                        0,
                                        LUNCH_MENU_QTY_MAX_DIGITS
                                      ),
                                    }));
                                  }}
                                  aria-label={`${m.name} の昼食数`}
                                />
                              </div>
                              <p className="min-w-0 border-t border-zinc-100 pt-3 text-base font-semibold leading-relaxed">
                                <span className="text-sm font-normal text-zinc-500">小計：</span>
                                <span className="tabular-nums text-zinc-900">
                                  {Number.isFinite(sub) ? formatTaxIncludedYen(sub) : "—"}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {lunchMenus.length > 1 ? (
                        <div className="border-t border-zinc-200 pt-3">
                          <p className="text-xs text-zinc-600">合計（税込）</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                            {editLunchTotalTaxIncluded?.ok
                              ? formatJpyInteger(editLunchTotalTaxIncluded.total)
                              : "—"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {/* PC: 表形式 */}
                    <div className="hidden min-w-0 sm:block">
                      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                        <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600">
                              <th className="px-2 py-1.5">メニュー</th>
                              <th className="px-2 py-1.5">税込単価</th>
                              <th className="px-2 py-1.5 text-right">昼食数</th>
                              <th className="px-2 py-1.5 text-right">小計</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lunchMenus.map((m) => {
                              const raw = editLunchQtyByMenuId[m.id] ?? "";
                              const parsed = parseLunchQuantityField(raw);
                              const sub = parsed.ok ? parsed.quantity * m.priceTaxIncluded : NaN;
                              return (
                                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                                  <td className="px-2 py-2 font-medium text-zinc-900">{m.name}</td>
                                  <td className="px-2 py-2 tabular-nums text-zinc-800">
                                    {formatJpyInteger(m.priceTaxIncluded)}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <input
                                      className="ml-auto min-h-10 w-14 rounded border border-zinc-300 px-1 py-1.5 text-center text-sm tabular-nums"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={LUNCH_MENU_QTY_MAX_DIGITS}
                                      value={raw}
                                      onChange={(e) => {
                                        dismissSaveFeedback();
                                        setEditLunchQtyByMenuId((prev) => ({
                                          ...prev,
                                          [m.id]: inputAsciiDigitsOnly(e.target.value).slice(
                                            0,
                                            LUNCH_MENU_QTY_MAX_DIGITS
                                          ),
                                        }));
                                      }}
                                      aria-label={`${m.name} の昼食数`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-right text-base font-semibold tabular-nums text-zinc-900">
                                    {Number.isFinite(sub) ? formatTaxIncludedYen(sub) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {lunchMenus.length > 1 ? (
                            <tfoot>
                              <tr className="border-t-2 border-zinc-200 bg-zinc-50/90">
                                <td
                                  colSpan={3}
                                  className="px-2 py-2.5 text-right text-xs font-semibold text-zinc-600"
                                >
                                  合計（税込）
                                </td>
                                <td className="px-2 py-2.5 text-right text-base font-bold tabular-nums text-rp-navy">
                                  {editLunchTotalTaxIncluded?.ok
                                    ? formatTaxIncludedYen(editLunchTotalTaxIncluded.total)
                                    : "—"}
                                </td>
                              </tr>
                            </tfoot>
                          ) : null}
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="sm:col-span-2 text-sm text-amber-800">
                    昼食メニューを読み込み中です。しばらくしてから再度お試しください。
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void saveEdits()}
                disabled={saving}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-sm hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
              >
                {saving ? <InlineSpinner variant="onDark" /> : null}
                {saving ? "変更を保存中…" : "変更を保存する"}
              </button>
            </div>
          )}
        </section>
      ) : reservation.status === "active" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {reservation.eventDay.status !== "open"
            ? "受付を終了したため、Web からは内容を変更できません。"
            : `${RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA}を過ぎたため、Web からは内容を変更できません。`}
        </p>
      ) : null}

      {/* キャンセル */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <h2 className="text-base font-bold text-rp-navy">キャンセル</h2>
        {reservation.status === "active" && canMutate ? (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-red-500 bg-white px-6 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:max-w-md"
          >
            {cancelling ? <InlineSpinner variant="onLight" /> : null}
            {cancelling ? "処理中…" : "予約をキャンセルする"}
          </button>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            {reservation.status === "cancelled" ? "キャンセル済み" : "キャンセル不可"}
          </p>
        )}
        {cancelMessage ? (
          <p className="mt-3 text-sm font-medium text-emerald-900">{cancelMessage}</p>
        ) : null}
      </section>
    </div>
  );
}
