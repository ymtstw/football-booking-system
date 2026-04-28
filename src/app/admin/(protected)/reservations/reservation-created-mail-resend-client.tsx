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
  /** true: 親カード側で枠・見出しがあるとき（アコーディオン内など） */
  embedded?: boolean;
};

/** 管理: 予約完了メールを任意アドレスへ再送（宛先指定＋送信） */
export function ReservationCreatedMailResendClient({
  reservationId,
  defaultToEmail,
  reservationActive,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [toEmail, setToEmail] = useState(defaultToEmail.trim());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const sendInFlightRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setCooldownUntil(readStoredUntil(reservationId));
  }, [reservationId]);

  useEffect(() => {
    setToEmail(defaultToEmail.trim());
  }, [defaultToEmail]);

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
      setConfirmOpen(false);
      const until = Date.now() + COOLDOWN_MS;
      writeStoredUntil(reservationId, until);
      setCooldownUntil(until);
      setMessage(
        json.message ??
          "予約完了メールを送信しました。確認コードがメールに記載されています。"
      );
      router.refresh();
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  const sendDisabled =
    sending || toEmail.trim() === "" || inCooldown;

  useEffect(() => {
    if (!confirmOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) {
        setConfirmOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, sending]);

  function openConfirm() {
    setError(null);
    setConfirmOpen(true);
  }

  const body = (
    <>
      {!embedded ? (
        <h2 className="text-sm font-semibold text-zinc-900">
          予約完了メールを再送する
        </h2>
      ) : null}
      <div
        className={`space-y-2 text-xs leading-snug text-zinc-700 sm:text-sm ${embedded ? "" : "mt-2"}`}
      >
        <p>予約者から「メールが届いていない」と連絡があった場合に使用します。</p>
        <p className="text-zinc-600">
          送信先のメールアドレスを確認してから再送してください。
        </p>
      </div>

      {!reservationActive ? (
        <p className="mt-3 text-sm text-zinc-600">
          キャンセル済みの予約には送信できません。
        </p>
      ) : (
        <>
          {message && !error ? (
            <div
              className="relative mt-3 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-sm"
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
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950"
              role="status"
            >
              しばらく再送できません（残り{" "}
              <span className="font-mono font-semibold tabular-nums">
                {formatRemainingMs(remainingMs)}
              </span>
              ）。
            </p>
          ) : null}

          <label className="mt-4 block text-sm">
            <span className="font-medium text-zinc-800">
              送信先メールアドレス
            </span>
            <input
              type="email"
              className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              disabled={sending}
              autoComplete="email"
            />
          </label>

          {!confirmOpen && error ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => openConfirm()}
            disabled={sendDisabled}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {inCooldown
              ? `再送まであと ${formatRemainingMs(remainingMs)}`
              : "予約完了メールを再送する"}
          </button>

          {confirmOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-[1px]"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !sending) {
                  setConfirmOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="resend-mail-confirm-title"
                className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl ring-1 ring-zinc-200/80"
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  id="resend-mail-confirm-title"
                  className="text-base font-bold text-zinc-900"
                >
                  メールを送信しますか？
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                  次の宛先に予約完了メールを送信します。よろしいですか？
                </p>
                <p className="mt-3 break-all rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900">
                  {toEmail.trim() || "（未入力）"}
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => setConfirmOpen(false)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
                  >
                    戻る
                  </button>
                  <button
                    type="button"
                    disabled={sendDisabled}
                    onClick={() => void send()}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
                  >
                    {sending ? <InlineSpinner variant="onDark" /> : null}
                    {sending ? "送信中…" : "再送する"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      {body}
    </section>
  );
}
