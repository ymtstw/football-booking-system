"use client";

import {
  NotificationFailedRetryTable,
  type NotificationListStatus,
} from "@/components/admin/notification-failed-retry-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

const TABS: readonly { status: NotificationListStatus; label: string }[] = [
  { status: "sent", label: "送信処理済み" },
  { status: "pending", label: "送信待ち" },
  { status: "failed", label: "送信エラー" },
] as const;

function parseStatus(raw: string | null): NotificationListStatus {
  if (raw === "sent" || raw === "pending" || raw === "failed") return raw;
  return "sent";
}

type Props = {
  /** 開催日で絞る場合（サーバー側で UUID 検証済み） */
  eventDayId?: string;
};

/**
 * 管理画面: メール通知の一覧タブ（送信処理済み / 送信待ち / 送信エラー）
 * URL の `status` と同期（メール内リンクで失敗タブを直接開ける）
 */
export function NotificationHistoryHubClient({ eventDayId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = useMemo(
    () => parseStatus(searchParams.get("status")),
    [searchParams]
  );

  const setStatus = useCallback(
    (next: NotificationListStatus) => {
      const q = new URLSearchParams();
      q.set("status", next);
      if (eventDayId) q.set("eventDayId", eventDayId);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [eventDayId, pathname, router]
  );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="メールの状態（3種類）"
        className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
      >
        {TABS.map(({ status: tabStatus, label }) => {
          const selected = status === tabStatus;
          return (
            <button
              key={tabStatus}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStatus(tabStatus)}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
      <NotificationFailedRetryTable eventDayId={eventDayId} listStatus={status} />
    </div>
  );
}
