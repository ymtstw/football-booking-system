import { InlineSpinner } from "@/components/ui/inline-spinner";

/** 予約セクション内のページ遷移中 */
export default function ReserveLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-10 text-sm text-zinc-600"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <InlineSpinner size="md" variant="onLight" />
      <p>読み込み中…</p>
    </div>
  );
}
