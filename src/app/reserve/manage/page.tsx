"use client";

/** SCR-03: 確認コードで照会・締切前なら変更・取消。 */
import { useRef, useState } from "react";

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

type ReservationJson = {
  reservation?: {
    id: string;
    status: string;
    participantCount: number;
    mealCount: number;
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

function isBeforeDeadline(deadlineIso: string): boolean {
  const t = new Date(deadlineIso).getTime();
  return Number.isFinite(t) && Date.now() < t;
}

type ReservationRow = NonNullable<ReservationJson["reservation"]>;

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
  const [editMeal, setEditMeal] = useState("");
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
    setEditMeal("");
    setEditContactName("");
    setEditContactPhone("");
  }

  function fillEditFieldsFromReservation(resv: ReservationRow) {
    setEditParticipant(String(resv.participantCount));
    setEditMeal(String(resv.mealCount));
    setEditContactName(resv.team.contactName);
    setEditContactPhone(resv.team.contactPhone);
  }

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
    else fillEditFieldsFromReservation(resv);
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
    const mc = parseInt(editMeal, 10);
    if (!Number.isInteger(pc) || pc < 1) {
      setSaveError("参加人数は 1 以上の整数にしてください");
      return;
    }
    if (!Number.isInteger(mc) || mc < 0) {
      setSaveError("昼食数は 0 以上の整数にしてください");
      return;
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
        mealCount: mc,
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
      fillEditFieldsFromReservation(json.reservation);
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
    <div className="space-y-6 sm:space-y-8">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          予約の確認・キャンセル
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          予約完了時に保存した確認コードを入力し、「確認」を押してください。締切前のみ Web
          から人数・昼食・代表者連絡先の変更やキャンセルができます。
        </p>
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700 sm:px-4">
          <p className="font-medium text-zinc-900">確認コードで確認できないとき</p>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 break-words">
            <li>前後の空白や改行が入っていないか確認し、もう一度貼り付けてください。</li>
            <li>
              64 文字の英数字（0–9 と a–f）だけか確認してください（コピー漏れ・1 文字多い等がよくあります）。
            </li>
            <li>
              開催日から 30 日を過ぎると確認できません（確認コードは無効になります）。
            </li>
            <li>
              それでも解決しない場合は、<strong>大会運営</strong>へお問い合わせください（配布資料や案内の連絡先）。
              いまの公開画面から確認コードを再送する機能はありません。運営が手元で確認・案内します。
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-4">
        <label className="block text-sm">
          <span className="text-zinc-700">予約確認コード</span>
          <textarea
            rows={4}
            className="mt-1 w-full resize-y rounded border border-zinc-300 px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 sm:text-sm"
            placeholder="64 文字の確認コード"
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
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "確認中…" : "確認"}
        </button>
        {lookupError && (
          <p className="text-sm text-red-700">{lookupError}</p>
        )}
      </div>

      {reservation && (
        <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-4">
          <h2 className="text-sm font-semibold text-zinc-800">予約内容</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-zinc-500 sm:pt-0.5">状態</dt>
            <dd className="min-w-0 font-medium">
              {reservation.status === "cancelled" ? "キャンセル済み" : "有効"}
            </dd>
            <dt className="text-zinc-500 sm:pt-0.5">開催日</dt>
            <dd className="min-w-0 break-words">
              {formatIsoDateWithWeekdayJa(reservation.eventDay.eventDate)}
            </dd>
            <dt className="text-zinc-500 sm:pt-0.5">学年帯</dt>
            <dd className="min-w-0">{reservation.eventDay.gradeBand}</dd>
            <dt className="text-zinc-500 sm:pt-0.5">午前枠</dt>
            <dd className="min-w-0">
              {reservation.morningSlot
                ? `${formatHm(reservation.morningSlot.startTime)}–${formatHm(reservation.morningSlot.endTime)}`
                : "—"}
            </dd>
            <dt className="text-zinc-500 sm:pt-0.5">チーム名</dt>
            <dd className="min-w-0 break-words">{reservation.team.teamName}</dd>
            <dt className="text-zinc-500 sm:pt-0.5">チームカテゴリ</dt>
            <dd className="min-w-0">
              {strengthCategoryLabelJa(reservation.team.strengthCategory)}
            </dd>
            <dt className="text-zinc-500 sm:pt-0.5">メール</dt>
            <dd className="min-w-0 break-all">{reservation.team.contactEmail}</dd>
          </dl>

          {canEdit ? (
            <div className="space-y-3 border-t border-zinc-100 pt-4">
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
                参加人数・昼食数・チーム代表者名・電話番号を更新できます。チーム名・メール・午前枠の変更は運営へお問い合わせください。
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
                <label className="block min-w-0 text-sm sm:col-span-1">
                  <span className="text-zinc-700">昼食数</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={editMeal}
                    onChange={(e) => {
                      dismissSaveFeedback();
                      setEditMeal(inputAsciiDigitsOnly(e.target.value));
                    }}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveEdits()}
                disabled={saving}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
              >
                {saving ? <InlineSpinner variant="onDark" /> : null}
                {saving ? "保存中…" : "変更を保存"}
              </button>
            </div>
          ) : reservation.status === "active" ? (
            <p className="border-t border-zinc-100 pt-4 text-sm text-zinc-600">
              {reservation.eventDay.status !== "open"
                ? "受付を終了したため、Web からは内容を変更できません。"
                : "締切を過ぎたため、Web からは内容を変更できません。"}
            </p>
          ) : null}

          {cancelMessage && (
            <p className="text-sm text-emerald-800">{cancelMessage}</p>
          )}

          {reservation.status === "active" && canMutate && (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 disabled:cursor-wait disabled:opacity-50 sm:w-auto"
            >
              {cancelling ? <InlineSpinner variant="onLight" /> : null}
              {cancelling ? "処理中…" : "予約をキャンセルする"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
