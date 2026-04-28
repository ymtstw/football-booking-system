/** 予約一覧・詳細で共通利用する状態バッジ（色＋文字） */

export function ReservationStatusBadge({ status }: { status: string }) {
  let label = "要確認";
  let cls =
    "border-amber-200 bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (status === "active") {
    label = "有効";
    cls =
      "border-emerald-200 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80";
  } else if (status === "cancelled") {
    label = "キャンセル済み";
    cls =
      "border-zinc-300 bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight ${cls}`}
    >
      {label}
    </span>
  );
}
