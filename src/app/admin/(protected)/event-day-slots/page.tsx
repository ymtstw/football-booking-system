import Link from "next/link";

/** SCR-14 開催日枠管理（UI 枠のみ・データ連携は未実装） */
export default function AdminEventDaySlotsPlaceholderPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">SCR-14 / Phase 1〜3 で拡張予定</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          開催日枠の管理
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          枠の追加・時刻・有効化は
          <Link href="/admin/event-days" className="mx-0.5 font-medium text-zinc-900 underline">
            開催日管理
          </Link>
          の各行「枠・時刻」から行います。本ページはレイアウト検討用のプレースホルダです。
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">開催日の選択</h2>
        <div className="mt-3 min-h-[48px] rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
          日付・開催日 ID 選択（ダミー）
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">枠一覧（午前 / 午後）</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700">
              <tr>
                <th className="px-3 py-2">枠</th>
                <th className="px-3 py-2">時刻</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-3 text-zinc-400">—</td>
                  <td className="px-3 py-3 text-zinc-400">—</td>
                  <td className="px-3 py-3 text-zinc-400">—</td>
                  <td className="px-3 py-3 text-zinc-400">…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <span className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-zinc-100 px-4 text-sm text-zinc-500">
          枠を追加（ダミー）
        </span>
        <span className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-zinc-100 px-4 text-sm text-zinc-500">
          選択枠を無効化（ダミー）
        </span>
      </div>
    </div>
  );
}
