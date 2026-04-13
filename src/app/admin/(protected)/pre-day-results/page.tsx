import Link from "next/link";

/** SCR-11 前日確定結果一覧（UI 枠のみ・データ連携は未実装） */
export default function AdminPreDayResultsPlaceholderPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">SCR-11 / Phase 2 予定</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          前日確定結果一覧
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          午前・午後の確定試合、審判候補、warning を一覧表示する画面のプレースホルダです。API
          連携は後から実装します。
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">午前の確定</h2>
        <div className="mt-3 min-h-[120px] rounded-md bg-zinc-50 text-center text-sm text-zinc-500">
          <span className="inline-flex min-h-[120px] items-center px-4">
            表・カード表示エリア（ダミー）
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">午後の確定</h2>
        <div className="mt-3 min-h-[120px] rounded-md bg-zinc-50 text-center text-sm text-zinc-500">
          <span className="inline-flex min-h-[120px] items-center px-4">
            表・カード表示エリア（ダミー）
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">審判候補・注意（warning）</h2>
        <div className="mt-3 min-h-[80px] rounded-md bg-zinc-50 text-center text-sm text-zinc-500">
          <span className="inline-flex min-h-[80px] items-center px-4">補足表示エリア（ダミー）</span>
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        <Link href="/admin/pre-day-adjust" className="font-medium text-zinc-900 underline">
          前日確定の補正
        </Link>
        へ進む想定（別画面プレースホルダ）。
      </p>
    </div>
  );
}
