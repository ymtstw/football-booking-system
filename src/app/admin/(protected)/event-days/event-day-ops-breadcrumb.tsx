import Link from "next/link";

const linkMuted =
  "font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950";

export type EventDayOpsBreadcrumbItem = { href?: string; label: string };

type Props = {
  eventDayId: string;
  /** 一覧の次に並べる項目。末尾は href 省略で現在地 */
  items: readonly EventDayOpsBreadcrumbItem[];
};

/** 開催日まわりの深い画面から「この開催のまとめ」へ戻す共通パンくず */
export function EventDayOpsBreadcrumb({ eventDayId, items }: Props) {
  return (
    <nav aria-label="開催日まわりのパンくず" className="mb-4 text-sm text-zinc-600">
      <Link href={`/admin/event-days/${eventDayId}`} className={linkMuted}>
        ← この開催のまとめ
      </Link>
      <span className="mx-1.5 text-zinc-400">·</span>
      <Link href="/admin/event-days" className={linkMuted}>
        開催日一覧
      </Link>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          <span className="mx-1.5 text-zinc-400">·</span>
          {item.href ? (
            <Link href={item.href} className={linkMuted}>
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-zinc-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
