import type { LunchMenuCountLine } from "@/lib/admin/dashboard-event-day-summary.types";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";

/**
 * 運営ハブ用: その日に選べる昼食メニュー（実効一覧）を軸に、予約スナップショットの集計を数量として付与する。
 * 予約が無いメニューは quantity 0。実効一覧に無いが予約に残っている名称は末尾に追加（名称変更など）。
 */
export function mergeEffectiveLunchMenuRowsForHub(
  effectiveItems: LunchMenuItemPublic[],
  reservationCounts: LunchMenuCountLine[]
): LunchMenuCountLine[] {
  const countMap = new Map<string, number>();
  for (const row of reservationCounts) {
    countMap.set(row.itemName, row.quantity);
  }
  const effectiveNames = new Set(effectiveItems.map((i) => i.name));

  const lines: LunchMenuCountLine[] = effectiveItems.map((item) => ({
    itemName: item.name,
    quantity: countMap.get(item.name) ?? 0,
  }));

  for (const row of reservationCounts) {
    if (!effectiveNames.has(row.itemName)) {
      lines.push(row);
    }
  }
  return lines;
}
