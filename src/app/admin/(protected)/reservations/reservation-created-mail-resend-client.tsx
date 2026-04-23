"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";

const COOLDOWN_MS = 5 * 60 * 1000;
const COOLDOWN_STORAGE_PREFIX = "fb_admin_res_created_mail_cd_v1_";

function cooldownStorageKey(reservationId: string) {
  return `${COOLDOWN_STORAGE_PREFIX}${reservationId}`;
}

function readStoredUntil(reservationId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(cooldownStorageKey(reservationId));
  if (!raw) return null;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.sessionStorage.removeItem(cooldownStorageKey(reservationId));
    return null;
  }
  return until;
}

function writeStoredUntil(reservationId: string, until: number) {
  window.sessionStorage.setItem(cooldownStorageKey(reservationId), String(until));
}

function clearStoredCooldown(reservationId: string) {
  window.sessionStorage.removeItem(cooldownStorageKey(reservationId));
}

function formatRemainingMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type Props = {
  reservationId: string;
  /** DB に保存されている登録メール（初期の送信先） */
  defaultToEmail: string;
  reservationActive: boolean;
};

/** 管理: 予約完了メールを任意アドレスへ再送（宛先指定＋送信） */
export function ReservationCreatedMailResendClient({
  reservationId,
  defaultToEmail,
  reservationActive,
}: Props) {
  const router = useRouter();
  const [toEmail, setToEmail] = useState(defaultToEmail.trim());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  /** クールダウン中の残り表示用に 1 秒ごと更新 */
  const [, setTick] = useState(0);
  /** 再描画前の連打でも二重 POST しない（pending 行の重複防止） */
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    setCooldownUntil(readStoredUntil(reservationId));
  }, [reservationId]);

  useEffect(() => {
    if (cooldownUntil == null) return;
    if (Date.now() >= cooldownUntil) {
      clearStoredCooldown(reservationId);
      setCooldownUntil(null);
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now >= cooldownUntil) {
        clearStoredCooldown(reservationId);
        setCooldownUntil(null);
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil, reservationId]);

  const inCooldown =
    cooldownUntil != null && Date.now() < cooldownUntil;
  const remainingMs =
    cooldownUntil != null ? Math.max(0, cooldownUntil - Date.now()) : 0;

  async function send() {
    if (inCooldown) return;
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setMessage(null);
    setError(null);
    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${reservationId}/resend-created-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmail: toEmail.trim() }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "送信に失敗しました");
        return;
      }
      const until = Date.now() + COOLDOWN_MS;
      writeStoredUntil(reservationId, until);
      setCooldownUntil(until);
      setMessage(
        json.message ??
          "予約完了メールを送信しました。確認コードはメールに記載されています。"
      );
      router.refresh();
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  const sendDisabled =
    sending || toEmail.trim() === "" || inCooldown;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-900">予約完了メールの送信</h2>
      <p className="text-xs leading-relaxed text-zinc-600">
        指定したアドレス宛に、予約完了時と同じ内容のメール（確認コード同封）を送信します。通常の代表メール以外へ送る場合は、下の欄を書き換えてください。
      </p>
      <p className="text-xs font-medium leading-relaxed text-amber-900">
        再送では確認コードを<strong className="font-semibold">新しく発行</strong>
        します。以前の確認コードでの照会・変更はできなくなります（参加者にはメール記載の新コードを案内してください）。
      </p>

      {!reservationActive ? (
        <p className="text-sm text-zinc-600">取消済みの予約には送信できません。</p>
      ) : (
        <>
          {message && !error ? (
            <div
              className="relative overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-emerald-500"
                aria-hidden
              />
              <div className="pt-1">
                <p className="text-sm font-semibold text-emerald-950">
                  メールを送信しました
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
                  {message}
                </p>
              </div>
            </div>
          ) : null}

          {inCooldown ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950"
              role="status"
            >
              誤って連続送信しないよう、しばらく再送ボタンは使えません（残り{" "}
              <span className="font-mono font-semibold tabular-nums">
                {formatRemainingMs(remainingMs)}
              </span>
              ）。必要なら時間が経ってから再度お試しください。
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="font-medium text-zinc-800">送信先メールアドレス</span>
            <input
              type="email"
              className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              disabled={sending}
              autoComplete="email"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void send()}
            disabled={sendDisabled}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {sending ? <InlineSpinner variant="onDark" /> : null}
            {sending
              ? "送信中…"
              : inCooldown
                ? `再送まであと ${formatRemainingMs(remainingMs)}`
                : "予約完了メールを送信"}
          </button>
        </>
      )}
    </div>
  );
}
