"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  notificationTemplateLabelJa,
  summarizeOutboundEmailError,
} from "@/lib/admin/notification-failed-display";
import { formatDateTimeTokyo } from "@/lib/dates/format-jp-display";
import { useCallback, useEffect, useState } from "react";

const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const RETRY_COOLDOWN_STORAGE_PREFIX = "fb_admin_notif_retry_cd_v1_";

function retryCooldownStorageKey(notificationId: string) {
  return `${RETRY_COOLDOWN_STORAGE_PREFIX}${notificationId}`;
}

function readRetryCooldownUntil(notificationId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(retryCooldownStorageKey(notificationId));
  if (!raw) return null;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.sessionStorage.removeItem(retryCooldownStorageKey(notificationId));
    return null;
  }
  return until;
}

function writeRetryCooldownUntil(notificationId: string, until: number) {
  window.sessionStorage.setItem(retryCooldownStorageKey(notificationId), String(until));
}

function formatRetryRemainingMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export type FailedNotificationRow = {
  id: string;
  channel: string;
  status: string;
  template_key: string | null;
  error_message: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolved_note?: string | null;
  /** API / DB により文字列または JSON オブジェクトになることがある */
  payload_summary?: unknown;
  created_at: string;
  updated_at?: string | null;
  sent_at?: string | null;
  reservation_id: string | null;
  event_day_id?: string | null;
  eventDate?: string | null;
  gradeBand?: string | null;
  toEmail?: string | null;
  teamName?: string | null;
  contactName?: string | null;
};

export type NotificationListStatus = "failed" | "pending" | "sent";

type Props = {
  /** 指定時は当該開催日のみ。省略時は全開催日の failed 上位件 */
  eventDayId?: string;
  className?: string;
  /**
   * 一覧 API の status。省略時は failed（開催日の失敗ブロック・前日結果など）
   */
  listStatus?: NotificationListStatus;
};

function trimSummary(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/** 予約直後メール等: 一覧の列で識別できるため「補足」欄は「—」のみ */
function isReservationIdOnlyPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  const o = value as Record<string, unknown>;
  return (
    keys.length === 1 &&
    keys[0] === "reservation_id" &&
    typeof o.reservation_id === "string"
  );
}

/**
 * メール送信履歴の「補足」欄用。現場向けに UUID の生 JSON は出さず短文にする。
 * 再送ロジック用の詳細データはそのまま jsonb に残る（表示だけ要約）。
 */
function outboundPayloadSummaryForStaffDisplay(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "この送信には追加情報があります。詳細が必要な場合はメール設定が分かる担当へ相談してください。";
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  if (isReservationIdOnlyPayload(value)) {
    return "";
  }
  if (keys.length === 1 && keys[0] === "event_date" && typeof o.event_date === "string") {
    return `開催日 ${o.event_date} に関する送信です。`;
  }
  if (typeof o.event_date === "string" && typeof o.variant === "string") {
    const v = o.variant;
    const kind =
      v === "weather"
        ? "天候・実施区分"
        : v === "operational"
          ? "運営中止"
          : v === "normal"
            ? "通常"
            : "その他";
    return `前日最終メール（${kind}）。開催日 ${o.event_date}。`;
  }
  return "この送信には追加情報があります。詳細が必要な場合はメール設定が分かる担当へ相談してください。";
}

/** 失敗以外の一覧: 概要（送信・更新の時刻は「処理日時」列のみ。補足欄に sent_at は出さない） */
function OutboundNotificationSummaryCell({
  listStatus,
  payloadSummary,
}: {
  listStatus: Exclude<NotificationListStatus, "failed">;
  payloadSummary: unknown;
}) {
  const reservationOnly = isReservationIdOnlyPayload(payloadSummary);
  const summary = outboundPayloadSummaryForStaffDisplay(payloadSummary);
  if (listStatus === "sent") {
    if (reservationOnly) {
      return (
        <p className="text-zinc-500" title="開催日・種類・宛先・チーム・処理日時の列で識別できます">
          —
        </p>
      );
    }
    return (
      <div className="space-y-1 text-xs leading-relaxed text-zinc-800">
        <p className="wrap-break-word">
          {summary ? trimSummary(summary, 280) : "（概要テキストなし）"}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-xs leading-relaxed text-zinc-800">
      <p className="text-amber-900/90">
        このシステム上では、まだ「送信が完了した」と記録されていません。しばらくしてから「送信処理済み」を確認してください。
      </p>
      {summary ? <p className="wrap-break-word">{trimSummary(summary, 280)}</p> : null}
    </div>
  );
}

/** 送信エラー（送信処理時点）の内容: 管理者向け要約＋折りたたみ原文 */
function FailedNotificationErrorCell({
  errorMessage,
  compact,
}: {
  errorMessage: string | null;
  compact?: boolean;
}) {
  const { summaryJa, rawDetail } = summarizeOutboundEmailError(errorMessage);
  const summaryClass = compact
    ? "wrap-break-word text-sm leading-relaxed text-red-900"
    : "wrap-break-word text-xs leading-relaxed lg:text-sm";
  return (
    <div className="space-y-1.5">
      <p className={summaryClass}>{summaryJa}</p>
      {rawDetail ? (
        <details
          className={
            compact
              ? "rounded-md border border-red-200/60 bg-white/80 px-2 py-1.5 text-xs text-zinc-700"
              : "rounded border border-red-200/50 bg-white/90 px-2 py-1 text-[10px] text-zinc-700 lg:text-[11px]"
          }
        >
          <summary className="cursor-pointer select-none font-medium text-red-950/90">
            エラー詳細を確認
          </summary>
          <pre
            className={
              compact
                ? "mt-2 max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-snug text-zinc-800"
                : "mt-1 max-h-32 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[9px] leading-snug text-zinc-800 lg:text-[10px]"
            }
          >
            {rawDetail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function NotificationFailedRetryTable({
  eventDayId,
  className,
  listStatus = "failed",
}: Props) {
  const showRetry = listStatus === "failed";
  const [rows, setRows] = useState<FailedNotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** 再送ボタンのクールダウン残り表示用（1 秒ごと） */
  const [, setRetryCooldownTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRetryCooldownTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const qs = new URLSearchParams({ status: listStatus });
    if (eventDayId) qs.set("eventDayId", eventDayId);
    else qs.set("limit", "150");
    try {
      const res = await fetch(`/api/admin/notifications?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { notifications?: FailedNotificationRow[]; error?: string };
      if (!res.ok) {
        setRows(null);
        setError(json.error ?? "一覧を取得できませんでした。再読み込みするか、ログイン状態を確認してください。");
        return;
      }
      const rawRows = json.notifications ?? [];
      const filtered =
        listStatus === "failed"
          ? rawRows.filter((r) => r.resolved_at == null)
          : rawRows;
      setRows(filtered);
    } catch {
      setRows(null);
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [eventDayId, listStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryOne = async (id: string) => {
    setRetryingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/notifications/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok?: boolean; status?: string; error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "再送できませんでした。しばらくしてから試すか、システム担当へ相談してください。");
        return;
      }
      writeRetryCooldownUntil(id, Date.now() + RETRY_COOLDOWN_MS);
      setMessage(
        json.status === "sent"
          ? "再送が完了しました。"
          : json.status === "failed"
            ? "再送は失敗しました。表示されている内容を確認するか、担当へ相談してください。"
            : "送信結果がまだ確定していません。しばらくして一覧を再読み込みするか、担当へ相談してください。"
      );
      await load();
    } catch {
      setMessage("再送リクエストで通信エラーが発生しました");
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <p className="text-sm text-zinc-600">読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={["min-w-0 w-full", className].filter(Boolean).join(" ")}>
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
        >
          再読み込み
        </button>
        {message ? (
          <p className="text-sm text-zinc-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
      {!rows?.length ? (
        <div className="space-y-1.5 text-sm text-zinc-600">
          <p>
            {listStatus === "failed"
              ? "いまの条件では、送信エラーとして記録されているメールはありません。"
              : listStatus === "sent"
                ? "送信処理済みとして記録されているメールはまだありません。"
                : "送信待ちのメールはありません。"}
          </p>
          {listStatus === "failed" ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              ※この一覧にない場合でも、メールが届いていないことがあります。
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {/* スマホ・狭い幅: 横スクロールなしのカード */}
          <div className="space-y-3 md:hidden">
            {rows.map((n) => {
              const cooldownUntil = readRetryCooldownUntil(n.id);
              const cooldownRemainingMs =
                cooldownUntil != null ? Math.max(0, cooldownUntil - Date.now()) : 0;
              const processedAtJa = (() => {
                const raw = n.updated_at ?? n.created_at;
                return raw ? formatDateTimeTokyo(raw) : "—";
              })();
              return (
                <article
                  key={n.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  {!eventDayId ? (
                    <p className="text-xs text-zinc-600">
                      <span className="font-medium text-zinc-800">開催日</span>{" "}
                      {n.eventDate ?? "—"}
                      {n.gradeBand ? (
                        <span className="text-zinc-500">（{n.gradeBand}）</span>
                      ) : null}
                    </p>
                  ) : null}
                  <dl className="mt-3 space-y-2.5 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">処理日時</dt>
                      <dd className="mt-0.5 text-xs text-zinc-800">{processedAtJa}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">種類</dt>
                      <dd className="mt-0.5 wrap-break-word text-xs text-zinc-900">
                        {notificationTemplateLabelJa(n.template_key)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">宛先</dt>
                      <dd className="mt-0.5 wrap-break-word text-zinc-800">{n.toEmail ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">チーム</dt>
                      <dd className="mt-0.5 wrap-break-word text-zinc-800">{n.teamName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">内容</dt>
                      <dd className="mt-0.5">
                        {listStatus === "failed" ? (
                          <FailedNotificationErrorCell errorMessage={n.error_message} compact />
                        ) : listStatus === "sent" ? (
                          <OutboundNotificationSummaryCell
                            listStatus="sent"
                            payloadSummary={n.payload_summary}
                          />
                        ) : (
                          <OutboundNotificationSummaryCell
                            listStatus="pending"
                            payloadSummary={n.payload_summary}
                          />
                        )}
                      </dd>
                    </div>
                  </dl>
                  {showRetry ? (
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      {n.template_key === "reservation_created" ? (
                        <div>
                          <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                            再送不可
                          </span>
                          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                            再送できない種類の通知です。必要に応じて、予約詳細から案内してください。
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            retryingId !== null ||
                            (cooldownRemainingMs > 0 && retryingId !== n.id)
                          }
                          onClick={() => void retryOne(n.id)}
                          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-indigo-700 px-3 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-45"
                        >
                          {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                          {retryingId === n.id
                            ? "送信中…"
                            : cooldownRemainingMs > 0
                              ? `再送まで ${formatRetryRemainingMs(cooldownRemainingMs)}`
                              : "このメールを再送する"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {/* md 以上: テーブル */}
          <div className="hidden min-w-0 max-w-full md:block md:overflow-x-auto md:overscroll-x-contain md:rounded-md md:border md:border-zinc-200 md:bg-white md:[-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-0 border-collapse text-left text-xs text-zinc-800 lg:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  {!eventDayId ? (
                    <th className="px-3 py-2 font-medium text-zinc-900">開催日</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium text-zinc-900">処理日時</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">種類</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">宛先</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">チーム</th>
                  <th
                    className="min-w-48 max-w-md px-3 py-2 font-medium text-zinc-900"
                    title="送信エラーの説明・送信待ちの補足・送信済みの概要など。不要な場合は「—」です。"
                  >
                    内容
                  </th>
                  {showRetry ? (
                    <th className="px-3 py-2 font-medium text-zinc-900">対応</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((n) => {
                  const cooldownUntil = readRetryCooldownUntil(n.id);
                  const cooldownRemainingMs =
                    cooldownUntil != null ? Math.max(0, cooldownUntil - Date.now()) : 0;
                  return (
                  <tr key={n.id}>
                    {!eventDayId ? (
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                        {n.eventDate ?? "—"}
                        {n.gradeBand ? (
                          <span className="ml-1 text-zinc-500">（{n.gradeBand}）</span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-600">
                      {(n.updated_at ?? n.created_at)
                        ? formatDateTimeTokyo((n.updated_at ?? n.created_at) as string)
                        : "—"}
                    </td>
                    <td className="max-w-40 px-3 py-2 text-[11px] text-zinc-800 lg:max-w-48 lg:text-xs">
                      {notificationTemplateLabelJa(n.template_key)}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-zinc-700" title={n.toEmail ?? ""}>
                      {n.toEmail ?? "—"}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2 text-zinc-700" title={n.teamName ?? ""}>
                      {n.teamName ?? "—"}
                    </td>
                    <td
                      className={[
                        "max-w-md px-3 py-2 align-top",
                        listStatus === "failed" ? "text-red-900" : "text-zinc-800",
                      ].join(" ")}
                    >
                      {listStatus === "failed" ? (
                        <FailedNotificationErrorCell errorMessage={n.error_message} />
                      ) : listStatus === "sent" ? (
                        <OutboundNotificationSummaryCell
                          listStatus="sent"
                          payloadSummary={n.payload_summary}
                        />
                      ) : (
                        <OutboundNotificationSummaryCell
                          listStatus="pending"
                          payloadSummary={n.payload_summary}
                        />
                      )}
                    </td>
                    {showRetry ? (
                      <td className="whitespace-nowrap px-3 py-2 align-top">
                        {n.template_key === "reservation_created" ? (
                          <div className="max-w-44 text-left">
                            <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">
                              再送不可
                            </span>
                            <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                              再送できない種類の通知です。必要に応じて、予約詳細から案内してください。
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              retryingId !== null ||
                              (cooldownRemainingMs > 0 && retryingId !== n.id)
                            }
                            onClick={() => void retryOne(n.id)}
                            className="inline-flex min-h-9 items-center justify-center rounded-md bg-indigo-700 px-2.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-45"
                          >
                            {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                            {retryingId === n.id
                              ? "送信中…"
                              : cooldownRemainingMs > 0
                                ? `再送まで ${formatRetryRemainingMs(cooldownRemainingMs)}`
                                : "このメールを再送する"}
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {rows?.length && showRetry ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          この一覧は、送信できなかった可能性がある通知のみ表示しています。
          <br />
          あとから「届いていない」と分かった場合は、予約詳細を確認して必要な案内を行ってください。
        </p>
      ) : null}
    </div>
  );
}
