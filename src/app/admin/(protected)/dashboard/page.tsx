/** 管理ダッシュボード（MVP プレースホルダ。開催日管理への導線）。 */
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="min-w-0">
      <h1 className="mb-3 text-xl font-semibold text-zinc-900 sm:mb-4 sm:text-2xl">
        ダッシュボード
      </h1>
      <p className="mb-4 text-sm leading-relaxed text-zinc-600 sm:text-base">
        MVP では開催日管理を中心に進めます。
      </p>
      <Link
        href="/admin/event-days"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
      >
        開催日管理へ
      </Link>
    </div>
  );
}
