import { InlineSpinner } from "@/components/ui/inline-spinner";

/** 開催確認・試合予定（日別）への遷移直後〜クライアント取得完了までの表示 */
export default function ReserveScheduleDayLoading() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-5 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="rounded-[20px] border border-rp-mint-2 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-7 w-3/4 max-w-md animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-full max-w-sm animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <InlineSpinner size="md" variant="onLight" />
          <span>開催情報と試合予定を読み込んでいます…</span>
        </div>
      </div>
    </div>
  );
}
