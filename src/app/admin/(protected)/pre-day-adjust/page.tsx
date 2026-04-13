import Link from "next/link";

/** SCR-12 前日確定補正（UI 枠のみ・データ連携は未実装） */
export default function AdminPreDayAdjustPlaceholderPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">SCR-12 / Phase 3 予定</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          前日確定の補正
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          チーム差し替え・枠変更など、運用補正のための画面のプレースホルダです。
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">対象試合の選択</h2>
        <div className="mt-3 min-h-[72px] rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
          セレクト / 一覧から選択（ダミー）
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-medium text-zinc-800">チーム差し替え</h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-500">
            <div className="h-10 rounded border border-zinc-200 bg-zinc-50" />
            <div className="h-10 rounded border border-zinc-200 bg-zinc-50" />
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-medium text-zinc-800">枠・時刻の変更</h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-500">
            <div className="h-10 rounded border border-zinc-200 bg-zinc-50" />
            <div className="h-10 rounded border border-zinc-200 bg-zinc-50" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-800">理由・保存</h2>
        <div className="mt-3 min-h-[88px] rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
          補正理由テキスト + 確定ボタン置き場（ダミー）
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        <Link href="/admin/pre-day-results" className="font-medium text-zinc-900 underline">
          前日確定結果一覧
        </Link>
        に戻る想定。
      </p>
    </div>
  );
}
