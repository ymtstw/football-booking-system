/** 管理ダッシュボード（MVP プレースホルダ。開催日管理への導線）。 */
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">ダッシュボード</h1>
      <p className="mb-4 text-zinc-600">
        MVP では開催日管理を中心に進めます。
      </p>
      <Link
        href="/admin/event-days"
        className="inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        開催日管理へ
      </Link>
    </div>
  );
}
