import { campInquiryStatusLabelJa } from "@/lib/camp-inquiry/camp-inquiry-status";

/** 一覧・詳細で共通。色＋必ず文字ラベル */
export function InquiryStatusBadge({ status }: { status: string }) {
  const label = campInquiryStatusLabelJa(status);
  const tone =
    status === "new" || status === "follow_up"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : status === "in_progress"
        ? "border-sky-300 bg-sky-50 text-sky-950"
        : status === "done"
          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
          : "border-zinc-200 bg-zinc-100 text-zinc-800";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}
