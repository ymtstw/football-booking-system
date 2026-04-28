import { describe, expect, it } from "vitest";

import { mergeEffectiveLunchMenuRowsForHub } from "@/lib/admin/merge-effective-lunch-menu-for-hub";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";

function item(partial: Partial<LunchMenuItemPublic> & Pick<LunchMenuItemPublic, "id" | "name">): LunchMenuItemPublic {
  return {
    description: null,
    priceTaxIncluded: 500,
    sortOrder: 0,
    ...partial,
  };
}

describe("mergeEffectiveLunchMenuRowsForHub", () => {
  it("実効メニュー順で0埋めし、予約が無いときも名称を出す", () => {
    const effective = [
      item({ id: "a", name: "A弁当", sortOrder: 0 }),
      item({ id: "b", name: "B弁当", sortOrder: 1 }),
    ];
    const merged = mergeEffectiveLunchMenuRowsForHub(effective, []);
    expect(merged).toEqual([
      { itemName: "A弁当", quantity: 0 },
      { itemName: "B弁当", quantity: 0 },
    ]);
  });

  it("予約集計で数量を差し込み、実効に無いスナップショット名は末尾に追加", () => {
    const effective = [item({ id: "a", name: "A弁当" })];
    const merged = mergeEffectiveLunchMenuRowsForHub(effective, [
      { itemName: "A弁当", quantity: 3 },
      { itemName: "旧メニュー名", quantity: 1 },
    ]);
    expect(merged).toEqual([
      { itemName: "A弁当", quantity: 3 },
      { itemName: "旧メニュー名", quantity: 1 },
    ]);
  });
});
