"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkMuted =
  "font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950";

export type EventDayOpsBreadcrumbItem = { href?: string; label: string };

type Props = {
  eventDayId: string;
  /** 一覧の次に並べる項目。末尾は href 省略で現在地 */
  items: readonly EventDayOpsBreadcrumbItem[];
};

/** 広い順：ダッシュボード → 開催日一覧 → この日の運営画面 → 直下の画面 */
export function EventDayOpsBreadcrumb({ eventDayId, items }: Props) {
  const pathname = usePathname();
  const currentPath = (pathname?.replace(/\/+$/, "") || pathname || "").trim();

  function isCurrent(href: string | undefined): boolean {
    if (!href) return false;
    const h = href.replace(/\/+$/, "") || href;
    return Boolean(currentPath) && h === currentPath;
  }

  const currentLabel =
    "font-semibold text-zinc-900";

  const currentSpan = (label: string) => (
    <span className={currentLabel} aria-current="page">
      {label}
    </span>
  );

  return (
    <nav aria-label="開催日まわりのパンくず" className="mb-4 text-sm text-zinc-600">
      {isCurrent("/admin/dashboard")
        ? currentSpan("ダッシュボード")
        : (
          <Link href="/admin/dashboard" className={linkMuted}>
            ダッシュボード
          </Link>
        )}
      <span className="mx-1.5 text-zinc-400">·</span>
      {isCurrent("/admin/event-days")
        ? currentSpan("開催日一覧")
        : (
          <Link href="/admin/event-days" className={linkMuted}>
            開催日一覧
          </Link>
        )}
      <span className="mx-1.5 text-zinc-400">·</span>
      {(() => {
        const hubHref = `/admin/event-days/${eventDayId}`;
        return isCurrent(hubHref)
          ? currentSpan("この日の運営画面")
          : (
            <Link href={hubHref} className={linkMuted}>
              この日の運営画面
            </Link>
          );
      })()}
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          <span className="mx-1.5 text-zinc-400">·</span>
          {item.href && !isCurrent(item.href) ? (
            <Link href={item.href} className={linkMuted}>
              {item.label}
            </Link>
          ) : (
            currentSpan(item.label)
          )}
        </span>
      ))}
    </nav>
  );
}
