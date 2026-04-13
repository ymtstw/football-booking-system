/** 管理ダッシュボード（MVP プレースホルダ。開催日管理・未実装画面の導線）。 */
import Link from "next/link";

const placeholderLinks = [
  { href: "/admin/event-days", label: "開催日管理", note: "実装済み" },
  { href: "/admin/event-day-slots", label: "開催日枠の管理", note: "SCR-14・枠のみ" },
  { href: "/admin/pre-day-results", label: "前日確定結果一覧", note: "SCR-11・枠のみ" },
  { href: "/admin/pre-day-adjust", label: "前日確定の補正", note: "SCR-12・枠のみ" },
] as const;

export default function AdminDashboardPage() {
  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="mb-3 text-xl font-semibold text-zinc-900 sm:mb-4 sm:text-2xl">
          ダッシュボード
        </h1>
        <p className="mb-4 text-sm leading-relaxed text-zinc-600 sm:text-base">
          MVP では開催日管理を中心に進めます。以下の「枠のみ」はデザイン・スクショ用のプレースホルダです。
        </p>
        <Link
          href="/admin/event-days"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
        >
          開催日管理へ
        </Link>
      </div>

      <section aria-labelledby="admin-placeholder-nav">
        <h2
          id="admin-placeholder-nav"
          className="mb-3 text-sm font-medium text-zinc-800"
        >
          全画面への導線（デザイン確認用）
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {placeholderLinks.map(({ href, label, note }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col gap-0.5 px-4 py-3 text-sm hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-zinc-900">{label}</span>
                <span className="text-xs text-zinc-500">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
