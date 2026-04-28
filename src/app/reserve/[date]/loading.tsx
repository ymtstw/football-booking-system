import { InlineSpinner } from "@/components/ui/inline-spinner";

export default function ReserveByDateLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-10 text-sm text-zinc-600"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <InlineSpinner size="md" variant="onLight" />
      <p>予約画面を準備しています…</p>
    </div>
  );
}
