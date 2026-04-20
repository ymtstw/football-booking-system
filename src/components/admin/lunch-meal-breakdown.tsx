import type { LunchMenuCountLine } from "@/lib/admin/dashboard-event-day-summary.types";

type Props = {
  totalMeals: number;
  lunchByMenu: LunchMenuCountLine[];
  /**
   * panel: 単独カード（余白の多い画面向け）
   * inline: 一覧・表の中に埋め込む（枠なし・行のタイポと揃える）
   */
  variant?: "panel" | "inline";
};

/** 開催サマリ用: 昼食の合計とメニュー別内訳（予約時のメニュー名スナップショットで集計） */
export function LunchMealBreakdown({ totalMeals, lunchByMenu, variant = "panel" }: Props) {
  if (variant === "inline") {
    return (
      <div className="min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium text-zinc-600">食数合計</span>
          <span className="text-sm font-semibold tabular-nums text-zinc-900">{totalMeals}</span>
        </div>
        {lunchByMenu.length > 0 ? (
          <ul className="space-y-1.5 border-t border-zinc-100 pt-2" aria-label="メニュー別">
            {lunchByMenu.map((l) => (
              <li key={l.itemName} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium text-zinc-600 wrap-break-word">{l.itemName}</span>
                <span className="shrink-0 font-semibold tabular-nums text-zinc-900">{l.quantity}</span>
              </li>
            ))}
          </ul>
        ) : totalMeals > 0 ? (
          <p className="border-t border-zinc-100 pt-2 text-xs leading-relaxed text-amber-900">内訳を取得できませんでした。</p>
        ) : (
          <p className="border-t border-zinc-100 pt-2 text-xs text-zinc-500">該当する昼食はありません。</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full rounded-lg border border-zinc-200/90 bg-zinc-50/50 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200/80 pb-2">
        <span className="text-sm font-medium text-zinc-600">食数合計</span>
        <span className="text-sm font-semibold tabular-nums text-zinc-900">{totalMeals}</span>
      </div>
      {lunchByMenu.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label="メニュー別">
          {lunchByMenu.map((l) => (
            <li key={l.itemName} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium text-zinc-600 wrap-break-word">{l.itemName}</span>
              <span className="shrink-0 font-semibold tabular-nums text-zinc-900">{l.quantity}</span>
            </li>
          ))}
        </ul>
      ) : totalMeals > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-900">内訳を取得できませんでした。</p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">該当する昼食はありません。</p>
      )}
    </div>
  );
}
