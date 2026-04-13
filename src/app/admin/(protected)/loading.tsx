import { InlineSpinner } from "@/components/ui/inline-spinner";

/** 管理画面セグメント遷移中の共通表示 */
export default function AdminProtectedLoading() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-zinc-600"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <InlineSpinner size="md" variant="onLight" />
      <p>読み込み中…</p>
    </div>
  );
}
