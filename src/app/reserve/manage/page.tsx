"use client";

/** SCR-03: 確認コードで照会・締切前なら取消。 */
import { useState } from "react";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";
import {
  normalizeReservationTokenPlain,
  isValidReservationTokenFormat,
} from "@/lib/reservations/token-format";

type ReservationJson = {
  reservation?: {
    id: string;
    status: string;
    participantCount: number;
    mealCount: number;
    remarks: string;
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

export default function ReserveManagePage() {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<
    ReservationJson["reservation"] | null
  >(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function lookup() {
    setLookupError(null);
    setCancelMessage(null);
    const token = normalizeReservationTokenPlain(tokenInput);
    if (!isValidReservationTokenFormat(token)) {
      setLookupError("64 文字の英数字（確認コード）をそのまま貼り付けてください");
      setReservation(null);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`);
    const json = (await res.json().catch(() => ({}))) as ReservationJson;
    setLoading(false);
    if (!res.ok) {
      setReservation(null);
      setLookupError(json.error ?? "確認できませんでした");
      return;
    }
    setReservation(json.reservation ?? null);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">予約の確認・キャンセル</h1>
        <p className="mt-2 text-sm text-zinc-600">
          予約完了時に保存した確認コードを入力し、「確認」を押してください。締切前のみ Web
          からキャンセルできます。
        </p>
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">確認コードで確認できないとき</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
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

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-zinc-700">予約確認コード</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
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
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
        >
          {loading ? "確認中…" : "確認"}
        </button>
        {lookupError && (
          <p className="text-sm text-red-700">{lookupError}</p>
        )}
      </div>

      {reservation && (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-800">予約内容</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <dt className="text-zinc-500">状態</dt>
            <dd className="font-medium">
              {reservation.status === "cancelled" ? "キャンセル済み" : "有効"}
            </dd>
            <dt className="text-zinc-500">開催日</dt>
            <dd>{formatIsoDateWithWeekdayJa(reservation.eventDay.eventDate)}</dd>
            <dt className="text-zinc-500">学年帯</dt>
            <dd>{reservation.eventDay.gradeBand}</dd>
            <dt className="text-zinc-500">午前枠</dt>
            <dd>
              {reservation.morningSlot
                ? `${formatHm(reservation.morningSlot.startTime)}–${formatHm(reservation.morningSlot.endTime)}`
                : "—"}
            </dd>
            <dt className="text-zinc-500">チーム名</dt>
            <dd>{reservation.team.teamName}</dd>
            <dt className="text-zinc-500">チームカテゴリ</dt>
            <dd>{strengthCategoryLabelJa(reservation.team.strengthCategory)}</dd>
            <dt className="text-zinc-500">チーム代表者名</dt>
            <dd>{reservation.team.contactName}</dd>
            <dt className="text-zinc-500">メール</dt>
            <dd className="break-all">{reservation.team.contactEmail}</dd>
            <dt className="text-zinc-500">電話</dt>
            <dd>{reservation.team.contactPhone}</dd>
            <dt className="text-zinc-500">参加人数 / 昼食</dt>
            <dd>
              {reservation.participantCount} / {reservation.mealCount}
            </dd>
            {reservation.remarks ? (
              <>
                <dt className="text-zinc-500">備考</dt>
                <dd className="sm:col-span-2">{reservation.remarks}</dd>
              </>
            ) : null}
          </dl>

          {cancelMessage && (
            <p className="text-sm text-emerald-800">{cancelMessage}</p>
          )}

          {reservation.status === "active" && (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 disabled:opacity-50"
            >
              {cancelling ? "処理中…" : "予約をキャンセルする"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
