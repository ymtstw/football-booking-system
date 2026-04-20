"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  notificationTemplateLabelJa,
  summarizeOutboundEmailError,
} from "@/lib/admin/notification-failed-display";
import { useCallback, useEffect, useState } from "react";

export type FailedNotificationRow = {
  id: string;
  channel: string;
  status: string;
  template_key: string | null;
  error_message: string | null;
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

type Props = {
  /** 指定時は当該開催日のみ。省略時は全開催日の failed 上位件 */
  eventDayId?: string;
  className?: string;
};

/** 送信失敗のエラー: 管理者向け要約＋折りたたみ原文 */
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
            技術メッセージ{compact ? "（サポート用）" : ""}
          </summary>
          <pre
            className={
              compact
                ? "mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-snug text-zinc-800"
                : "mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-snug text-zinc-800 lg:text-[10px]"
            }
          >
            {rawDetail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function NotificationFailedRetryTable({ eventDayId, className }: Props) {
  const [rows, setRows] = useState<FailedNotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const qs = new URLSearchParams({ status: "failed" });
    if (eventDayId) qs.set("eventDayId", eventDayId);
    else qs.set("limit", "150");
    try {
      const res = await fetch(`/api/admin/notifications?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { notifications?: FailedNotificationRow[]; error?: string };
      if (!res.ok) {
        setRows(null);
        setError(json.error ?? `取得失敗（${res.status}）`);
        return;
      }
      setRows(json.notifications ?? []);
    } catch {
      setRows(null);
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [eventDayId]);

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
        setMessage(json.error ?? `再送失敗（${res.status}）`);
        return;
      }
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
          一覧を再読み込み
        </button>
        {message ? (
          <p className="text-sm text-zinc-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
      {!rows?.length ? (
        <p className="text-sm text-zinc-600">failed の通知はありません。</p>
      ) : (
        <>
          {/* スマホ・狭い幅: 横スクロールなしのカード */}
          <div className="space-y-3 md:hidden">
            {rows.map((n) => {
              const updatedUtc =
                (n.updated_at ?? n.created_at)?.replace("T", " ").slice(0, 19) ?? "—";
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
                      <dt className="text-xs font-medium text-zinc-500">更新（UTC）</dt>
                      <dd className="mt-0.5 font-mono text-xs text-zinc-800">{updatedUtc}</dd>
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
                        <FailedNotificationErrorCell errorMessage={n.error_message} compact />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    {n.template_key === "reservation_created" ? (
                      <div>
                        <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                          再送不可
                        </span>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                          確認用コードを画面に残さないため、この一覧から再送はできません。届いていない場合は、予約確認の案内を別途お伝えする運用で対応してください。
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={retryingId !== null}
                        onClick={() => void retryOne(n.id)}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-indigo-700 px-3 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-45"
                      >
                        {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                        {retryingId === n.id ? "送信中…" : "再送"}
                      </button>
                    )}
                  </div>
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
                  <th className="px-3 py-2 font-medium text-zinc-900">更新（UTC）</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">種類</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">宛先</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">チーム</th>
                  <th className="min-w-[12rem] max-w-md px-3 py-2 font-medium text-zinc-900">内容</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((n) => (
                  <tr key={n.id}>
                    {!eventDayId ? (
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                        {n.eventDate ?? "—"}
                        {n.gradeBand ? (
                          <span className="ml-1 text-zinc-500">（{n.gradeBand}）</span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-zinc-600">
                      {(n.updated_at ?? n.created_at)?.replace("T", " ").slice(0, 19) ?? "—"}
                    </td>
                    <td
                      className="max-w-[10rem] px-3 py-2 text-[11px] text-zinc-800 lg:max-w-[12rem] lg:text-xs"
                      title={n.template_key ?? ""}
                    >
                      {notificationTemplateLabelJa(n.template_key)}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-zinc-700" title={n.toEmail ?? ""}>
                      {n.toEmail ?? "—"}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2 text-zinc-700" title={n.teamName ?? ""}>
                      {n.teamName ?? "—"}
                    </td>
                    <td className="max-w-md px-3 py-2 align-top text-red-900">
                      <FailedNotificationErrorCell errorMessage={n.error_message} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {n.template_key === "reservation_created" ? (
                        <div className="max-w-44 text-left">
                          <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">
                            再送不可
                          </span>
                          <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                            確認用コードを残さないため再送できません。届かない場合は予約確認の案内を別途送ってください。
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={retryingId !== null}
                          onClick={() => void retryOne(n.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-md bg-indigo-700 px-2.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-45"
                        >
                          {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                          {retryingId === n.id ? "送信中…" : "再送"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {rows?.length ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          「予約直後の確認メール」だけは安全のため再送できません（ボタンなし）。その他の失敗は、表示の内容を確認してから「再送」を試してください。
        </p>
      ) : null}
    </div>
  );
}
