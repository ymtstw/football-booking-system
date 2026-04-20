"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
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
          ? "再送が完了しました（sent）。"
          : json.status === "failed"
            ? "送信は再び失敗しました（failed）。エラー内容を確認してください。"
            : "送信はスキップされた可能性があります（pending のまま）。Resend の環境変数を確認してください。"
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
                      <dt className="text-xs font-medium text-zinc-500">テンプレ</dt>
                      <dd className="mt-0.5 wrap-break-word font-mono text-xs text-zinc-900">
                        {n.template_key ?? "—"}
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
                      <dt className="text-xs font-medium text-zinc-500">エラー</dt>
                      <dd className="mt-0.5 wrap-break-word text-sm leading-relaxed text-red-900">
                        {n.error_message ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    {n.template_key === "reservation_created" ? (
                      <div>
                        <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                          再送不可
                        </span>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                          予約完了は確認コードの平文を保持しないため、管理画面からの再送はできません。
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
            <table className="w-full min-w-176 border-collapse text-left text-xs text-zinc-800 lg:min-w-0 lg:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  {!eventDayId ? (
                    <th className="px-3 py-2 font-medium text-zinc-900">開催日</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium text-zinc-900">更新（UTC）</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">テンプレ</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">宛先</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">チーム</th>
                  <th className="px-3 py-2 font-medium text-zinc-900">エラー</th>
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
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] lg:text-xs">
                      {n.template_key ?? "—"}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-zinc-700" title={n.toEmail ?? ""}>
                      {n.toEmail ?? "—"}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2 text-zinc-700" title={n.teamName ?? ""}>
                      {n.teamName ?? "—"}
                    </td>
                    <td className="max-w-md px-3 py-2 wrap-break-word text-red-900">
                      {n.error_message ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {n.template_key === "reservation_created" ? (
                        <div className="max-w-44 text-left">
                          <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">
                            再送不可
                          </span>
                          <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                            予約完了は確認コードの平文を保持しないため、管理画面からの再送はできません（ボタンは出しません）。
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
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        予約完了（<code className="rounded bg-zinc-100 px-0.5">reservation_created</code>
        ）は確認コードの平文を保持しないため、一覧では「再送不可」と表示します（再送 API も 422 で拒否します）。
      </p>
    </div>
  );
}
