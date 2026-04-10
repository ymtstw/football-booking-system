/** DB / API の strength_category（strong | potential）とユーザー向け表示の対応。 */

export function strengthCategoryLabelJa(dbValue: string): string {
  if (dbValue === "strong") return "ハイレベル";
  if (dbValue === "potential") return "ポテンシャル";
  if (dbValue === "unknown") return "未分類";
  return dbValue;
}

export const RESERVE_STRENGTH_OPTIONS = [
  { value: "strong", label: "ハイレベル" },
  { value: "potential", label: "ポテンシャル" },
] as const;
