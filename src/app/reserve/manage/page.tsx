"use client";

/**
 * SCR-03: 確認コードで照会・変更・取消。API 側で open かつ締切前を検証。
 * 仕様: docs/spec/reservation-deadline-and-event-status.md
 */
import { useEffect, useRef, useState } from "react";

import { FieldLabel } from "../_components/field-label";
import { LunchOrderSummary } from "../_components/lunch-order-summary";
import {
  IconCalendar,
  IconClipboard,
  IconInfoCircle,
  IconPencil,
  IconSearch,
  IconTrash,
} from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";
import {
  normalizeReservationTokenPlain,
  isValidReservationTokenFormat,
} from "@/lib/reservations/token-format";
import {
  isContactPhoneDigitsValid,
  normalizeContactPhoneDigits,
} from "@/lib/validators/contact-phone";
import { inputAsciiDigitsOnly } from "@/lib/validators/digits-input";
import type { LunchMenuItemPublic, ReservationLunchLinePublic } from "@/lib/lunch/types";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";

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

export default function ReserveManagePage() {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<
    ReservationJson["reservation"] | null
  >(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [editParticipant, setEditParticipant] = useState("");
  const [lunchMenus, setLunchMenus] = useState<LunchMenuItemPublic[] | null>(null);
  const [editLunchQtyByMenuId, setEditLunchQtyByMenuId] = useState<
    Record<string, string>
  >({});
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveNoticeRef = useRef<HTMLDivElement>(null);

  function dismissSaveFeedback() {
    setSaveOk(null);
    setSaveError(null);
  }

  function clearEditFields() {
    setEditParticipant("");
    setEditLunchQtyByMenuId({});
    setEditContactName("");
    setEditContactPhone("");
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lunch-menu")
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          items?: LunchMenuItemPublic[];
        };
        if (cancelled) return;
        setLunchMenus(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {
        if (!cancelled) setLunchMenus([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          qty[m.id] = String(line?.quantity ?? 0);
        }
        setEditLunchQtyByMenuId(qty);
      } else {
        setEditLunchQtyByMenuId({});
      }
    });
  }, [reservation, lunchMenus]);

  async function lookup() {
    setLookupError(null);
    setCancelMessage(null);
    setSaveError(null);
    setSaveOk(null);
    const token = normalizeReservationTokenPlain(tokenInput);
    if (!isValidReservationTokenFormat(token)) {
      setLookupError("64 文字の英数字（確認コード）をそのまま貼り付けてください");
      setReservation(null);
      clearEditFields();
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`);
    const json = (await res.json().catch(() => ({}))) as ReservationJson;
    setLoading(false);
    if (!res.ok) {
      setReservation(null);
      clearEditFields();
      setLookupError(json.error ?? "確認できませんでした");
      return;
    }
    const resv = json.reservation ?? null;
    setReservation(resv);
    if (!resv) clearEditFields();
  }

  async function saveEdits() {
    setSaveError(null);
    setSaveOk(null);
    const token = normalizeReservationTokenPlain(tokenInput);
    if (!isValidReservationTokenFormat(token)) {
      setSaveError("確認コードが不正です");
      return;
    }
    if (!reservation || reservation.status !== "active") {
      setSaveError("変更できる予約がありません");
      return;
    }
    if (reservation.eventDay.status !== "open") {
      setSaveError("受付を終了したため、ここからは変更できません");
      return;
    }
    if (!isBeforeDeadline(reservation.eventDay.reservationDeadlineAt)) {
      setSaveError("締切を過ぎているため、ここからは変更できません");
      return;
    }

    const pc = parseInt(editParticipant, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      setSaveError("参加人数は 1 以上の整数にしてください");
      return;
    }
    if (!lunchMenus?.length) {
      setSaveError("昼食メニューを読み込めていません。しばらくしてから再度お試しください");
      return;
    }
    const lunchItems: { menuItemId: string; quantity: number }[] = [];
    for (const m of lunchMenus) {
      const raw = editLunchQtyByMenuId[m.id] ?? "0";
      const q = parseInt(raw, 10);
      if (!Number.isInteger(q) || q < 0 || q > 500) {
        setSaveError("昼食の数量は 0〜500 の整数にしてください");
        return;
      }
      lunchItems.push({ menuItemId: m.id, quantity: q });
    }
    if (!editContactName.trim()) {
      setSaveError("チーム代表者名を入力してください");
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
    const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantCount: pc,
        lunchItems,
        contactName: editContactName.trim(),
        contactPhone: phoneDigits,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      reservation?: ReservationJson["reservation"];
    };
    setSaving(false);

    if (!res.ok) {
      setSaveError(json.error ?? `保存に失敗しました（${res.status}）`);
      return;
    }
    if (json.reservation) {
      setReservation(json.reservation);
    } else {
      await lookup();
    }
    setSaveOk("変更が完了しました。内容は下記のとおり保存されています。");
    requestAnimationFrame(() => {
      saveNoticeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  async function cancel() {
    setCancelMessage(null);
    const token = normalizeReservationTokenPlain(tokenInput);
    if (!isValidReservationTokenFormat(token)) {
      setCancelMessage("確認コードが不正です");
      return;
    }
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
      setCancelMessage("締切を過ぎているため、ここからはキャンセルできません");
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
    const res = await fetch(
      `/api/reservations/${encodeURIComponent(token)}/cancel`,
      { method: "POST" }
    );
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      alreadyCancelled?: boolean;
    };
    setCancelling(false);
    if (!res.ok) {
      setCancelMessage(json.error ?? `キャンセルに失敗しました（${res.status}）`);
      return;
    }
    setCancelMessage(
      json.alreadyCancelled ? "すでにキャンセル済みです" : "キャンセルしました"
    );
    await lookup();
  }

  const canMutate =
    reservation &&
    reservation.status === "active" &&
    reservation.eventDay.status === "open" &&
    isBeforeDeadline(reservation.eventDay.reservationDeadlineAt);

  const canEdit = canMutate;

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="min-w-0">
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconClipboard className="h-6 w-6 sm:h-6 sm:w-6" />}
          textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
        >
          予約の確認・キャンセル
        </ReserveHeadingWithIcon>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
          ご予約内容の確認やキャンセルは、以下の情報を入力してご利用ください。
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="rounded-2xl border border-rp-mint-2 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rp-brand/10 text-rp-brand ring-1 ring-rp-brand/15">
              <IconClipboard className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-rp-navy">予約内容を確認する</h2>
              <p className="mt-1 text-xs text-zinc-600 sm:text-sm">
                予約完了時にお手元の確認コード（64 文字）を貼り付けてください。
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <FieldLabel required>予約確認コード</FieldLabel>
              <textarea
                rows={4}
                className="mt-2 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
                placeholder="64 文字の英数字をそのまま貼り付け"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={() => void lookup()}
              disabled={loading}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400"
            >
              {loading ? (
                <InlineSpinner variant="onDark" />
              ) : (
                <IconSearch className="h-5 w-5 shrink-0" />
              )}
              {loading ? "確認中…" : "予約内容を確認する"}
            </button>
            {lookupError ? (
              <p className="text-sm text-red-700">{lookupError}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-rp-mint-2 bg-rp-mint/40 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-rp-brand shadow-sm ring-1 ring-rp-mint-2">
              <IconInfoCircle className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-bold text-rp-navy">ご予約のキャンセルについて</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-800">
                <li>締切前であれば、この画面からキャンセルできます。</li>
                <li>締切後のキャンセルや無断欠席はお控えください。</li>
                <li>開催可否は原則として締切日時をもって判断されます。</li>
                <li>不明点はお問い合わせください。</li>
              </ul>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-zinc-200 bg-white/80 px-3 py-3 text-xs leading-relaxed text-zinc-700">
            <p className="font-medium text-zinc-900">確認コードで確認できないとき</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>前後の空白や改行が入っていないか確認してください。</li>
              <li>64 文字の英数字（0–9 と a–f）のみか確認してください。</li>
              <li>開催日から 30 日を過ぎると照会できません。</li>
            </ul>
          </div>
        </section>
      </div>

      {reservation && (
        <div className="overflow-hidden rounded-2xl border border-rp-mint-2 bg-rp-mint/30 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-rp-mint-2 bg-white/90 px-4 py-3 sm:px-5">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                reservation.status === "cancelled"
                  ? "bg-zinc-200 text-zinc-700"
                  : "bg-rp-brand text-white"
              }`}
            >
              {reservation.status === "cancelled" ? "キャンセル済み" : "予約受付中"}
            </span>
            <p className="text-sm font-semibold text-zinc-900">
              予約番号（確認コードの先頭表示）:{" "}
              <span className="font-mono text-xs sm:text-sm">
                {normalizeReservationTokenPlain(tokenInput).slice(0, 12)}…
              </span>
            </p>
          </div>
          <div className="border-t border-rp-mint-2 bg-white px-4 py-5 sm:px-6 sm:py-6">
            <h2 className="mb-4 flex items-center gap-2.5 text-base font-bold text-rp-navy">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rp-brand/10 text-rp-brand ring-1 ring-rp-brand/15">
                <IconCalendar className="h-5 w-5" />
              </span>
              予約内容（確認結果）
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-rp-brand/30 bg-rp-mint/40 p-5 text-center shadow-sm">
                <p className="text-xs font-semibold text-rp-brand">開催日</p>
                <p className="mt-2 text-lg font-bold leading-snug text-rp-brand">
                  {formatIsoDateWithWeekdayJa(reservation.eventDay.eventDate)}
                </p>
              </div>
              <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <dt className="text-zinc-500">対象学年帯</dt>
                <dd className="min-w-0 font-medium">
                  {gradeBandLabelJa(reservation.eventDay.gradeBand)}
                </dd>
                <dt className="text-zinc-500">チーム名</dt>
                <dd className="min-w-0 break-words font-medium">
                  {reservation.team.teamName}
                </dd>
                <dt className="text-zinc-500">代表者名</dt>
                <dd className="min-w-0">{reservation.team.contactName}</dd>
                <dt className="text-zinc-500">メールアドレス</dt>
                <dd className="min-w-0 break-all">{reservation.team.contactEmail}</dd>
                <dt className="text-zinc-500">参加人数</dt>
                <dd className="min-w-0 font-medium">{reservation.participantCount}名</dd>
                <dt className="text-zinc-500">午前枠</dt>
                <dd className="min-w-0">
                  {reservation.morningSlot
                    ? `${formatHm(reservation.morningSlot.startTime)}–${formatHm(reservation.morningSlot.endTime)}`
                    : "—"}
                </dd>
                <dt className="text-zinc-500">チームカテゴリ</dt>
                <dd className="min-w-0">
                  {strengthCategoryLabelJa(reservation.team.strengthCategory)}
                </dd>
              </dl>
              <div className="mt-4 border-t border-zinc-200 pt-4 sm:col-span-2">
                <p className="text-sm font-medium text-zinc-500">昼食</p>
                <div className="mt-2">
                  <LunchOrderSummary
                    lines={reservation.lunchItems}
                    totalTaxIncluded={reservation.lunchTotalTaxIncluded}
                  />
                </div>
              </div>
            </div>
          </div>

          {canEdit ? (
            <div className="space-y-3 border-t border-zinc-200 bg-zinc-50/80 px-4 py-5 sm:px-6">
              <h3 className="text-sm font-semibold text-zinc-800">
                締切前のみ変更可能
              </h3>
              <div ref={saveNoticeRef} className="space-y-2">
                {saveOk ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-950 shadow-sm"
                  >
                    {saveOk}
                  </div>
                ) : null}
                {saveError ? (
                  <div
                    role="alert"
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-950"
                  >
                    {saveError}
                  </div>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">
                参加人数・昼食（メニュー別数量）・チーム代表者名・電話番号を更新できます。チーム名・メール・午前枠の変更は運営へお問い合わせください。
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">チーム代表者名</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    value={editContactName}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditContactName(e.target.value);
                    }}
                    autoComplete="name"
                  />
                </label>
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">電話（数字のみ）</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    inputMode="numeric"
                    value={editContactPhone}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditContactPhone(
                        inputAsciiDigitsOnly(e.target.value)
                      );
                    }}
                    autoComplete="tel"
                  />
                </label>
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">参加人数</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={editParticipant}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditParticipant(inputAsciiDigitsOnly(e.target.value));
                    }}
                  />
                </label>
                {lunchMenus && lunchMenus.length > 0 ? (
                  <div className="sm:col-span-2 space-y-2">
                    <span className="block text-sm font-medium text-zinc-700">
                      昼食（数量・税込単価）
                    </span>
                    <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
                      <table className="w-full min-w-[260px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600">
                            <th className="px-2 py-1.5">メニュー</th>
                            <th className="px-2 py-1.5">税込単価</th>
                            <th className="px-2 py-1.5 text-right">数量</th>
                            <th className="px-2 py-1.5 text-right">小計</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lunchMenus.map((m) => {
                            const raw = editLunchQtyByMenuId[m.id] ?? "0";
                            const q = parseInt(raw, 10);
                            const ok = Number.isInteger(q) && q >= 0 && q <= 500;
                            const sub = ok ? q * m.priceTaxIncluded : NaN;
                            return (
                              <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                                <td className="px-2 py-2 font-medium text-zinc-900">{m.name}</td>
                                <td className="px-2 py-2 tabular-nums text-zinc-800">
                                  {formatTaxIncludedYen(m.priceTaxIncluded)}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <input
                                    className="ml-auto w-14 rounded border border-zinc-300 px-1 py-1 text-center text-sm tabular-nums"
                                    inputMode="numeric"
                                    value={raw}
                                    onChange={(e) => {
                                      dismissSaveFeedback();
                                      setEditLunchQtyByMenuId((prev) => ({
                                        ...prev,
                                        [m.id]: inputAsciiDigitsOnly(e.target.value),
                                      }));
                                    }}
                                    aria-label={`${m.name} の数量`}
                                  />
                                </td>
                                <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-900">
                                  {Number.isFinite(sub)
                                    ? formatTaxIncludedYen(sub)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="sm:col-span-2 text-sm text-amber-800">
                    昼食メニューを読み込み中です。読み込み後に数量を変更して保存してください。
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void saveEdits()}
                disabled={saving}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-sm hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
              >
                {saving ? (
                  <InlineSpinner variant="onDark" />
                ) : (
                  <IconPencil className="h-4 w-4 shrink-0" />
                )}
                {saving ? "保存中…" : "予約内容を編集する（保存）"}
              </button>
            </div>
          ) : reservation.status === "active" ? (
            <p className="border-t border-zinc-100 pt-4 text-sm text-zinc-600">
              {reservation.eventDay.status !== "open"
                ? "受付を終了したため、Web からは内容を変更できません。"
                : "締切を過ぎたため、Web からは内容を変更できません。"}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-4 py-5 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6">
            {reservation.status === "active" && canMutate ? (
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={cancelling}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-red-500 bg-white px-6 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:order-2 sm:w-auto"
              >
                {cancelling ? (
                  <InlineSpinner variant="onLight" />
                ) : (
                  <IconTrash className="h-4 w-4 shrink-0" />
                )}
                {cancelling ? "処理中…" : "予約をキャンセルする"}
              </button>
            ) : null}
          </div>

          {cancelMessage ? (
            <p className="border-t border-zinc-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900 sm:px-6">
              {cancelMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
