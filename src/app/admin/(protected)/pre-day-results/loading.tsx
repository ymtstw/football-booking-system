import { InlineSpinner } from "@/components/ui/inline-spinner";

export default function AdminPreDayResultsLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-10 text-sm text-zinc-600"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <InlineSpinner size="md" variant="onLight" />
      <p>試合表・編成画面を読み込み中…</p>
    </div>
  );
}
