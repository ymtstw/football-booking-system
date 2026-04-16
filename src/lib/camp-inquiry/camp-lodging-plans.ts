/**
 * 宿泊プランの表示定義（案内ページ・相談フォームの選択肢の共通元）。
 * 合宿まわりのシステム役割は「相談受付・受入判断材料・事前案内」までであり、開催当日の進行や対戦表は対象外。
 * 文言・日数パターンの追加/削除/非表示はこの配列と各要素の active / sortOrder で調整する。
 * DB の answers.preferred_plan には `id` が保存される（表示名は変更しても id で紐づく）。
 */

export type CampLodgingPlan = {
  /** 保存値（英字スネーク推奨・変更時は既存データとの整合に注意） */
  id: string;
  /** 一覧・フォームで見せる名称 */
  titleJa: string;
  /** 案内ページ用の短い説明（改行可） */
  summaryJa: string;
  /** false のとき案内・フォーム選択肢に出さない（一時的に1プランだけ等） */
  active: boolean;
  /** 昇順で並べる */
  sortOrder: number;
};

/**
 * 初期案（MVP）。プラン名・日数・本数は運用で変えてよい。
 * 追加するときは id を新規発行し、active と sortOrder を調整する。
 */
export const CAMP_LODGING_PLANS: readonly CampLodgingPlan[] = [
  {
    id: "stay_1n2d",
    titleJa: "1泊2日プラン",
    summaryJa:
      "到着日に交流を含めたご利用を想定した案内です（詳細は返信時にご相談）。",
    active: true,
    sortOrder: 10,
  },
  {
    id: "stay_2n3d",
    titleJa: "2泊3日プラン",
    summaryJa:
      "前後日を含めたゆとりある滞在を想定した案内です（詳細は返信時にご相談）。",
    active: true,
    sortOrder: 20,
  },
];

export function getActiveLodgingPlansSorted(): CampLodgingPlan[] {
  return [...CAMP_LODGING_PLANS]
    .filter((p) => p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** フォーム select 用（value = id, label = 表示名） */
export function getLodgingPlanSelectOptions(): { value: string; labelJa: string }[] {
  return getActiveLodgingPlansSorted().map((p) => ({
    value: p.id,
    labelJa: p.titleJa,
  }));
}

export function getLodgingPlanLabelJa(planId: string): string | null {
  const p = CAMP_LODGING_PLANS.find((x) => x.id === planId);
  return p?.titleJa ?? null;
}

export function isActiveLodgingPlanId(planId: string): boolean {
  return getActiveLodgingPlansSorted().some((p) => p.id === planId);
}
