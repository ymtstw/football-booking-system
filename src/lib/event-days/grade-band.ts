/** 開催日の学年帯（アンダー年生・V2） */

export const GRADE_BANDS = ["U-1", "U-2", "U-3", "U-4", "U-5", "U-6"] as const;

export type GradeBand = (typeof GRADE_BANDS)[number];

export const GRADE_BAND_OPTIONS: ReadonlyArray<{ value: GradeBand; label: string }> = [
  { value: "U-1", label: "1年生以下（通常は未使用）" },
  { value: "U-2", label: "2年生以下" },
  { value: "U-3", label: "3年生以下" },
  { value: "U-4", label: "4年生以下" },
  { value: "U-5", label: "5年生以下" },
  { value: "U-6", label: "6年生以下" },
];

export function isGradeBand(value: string): value is GradeBand {
  return (GRADE_BANDS as readonly string[]).includes(value.trim());
}

/** U-1 / U-2 は30分・午前のみテンプレ */
export function isUnder2GradeBand(gradeBand: string): boolean {
  const g = gradeBand.trim();
  return g === "U-1" || g === "U-2";
}

export function gradeBandMaxYear(gradeBand: string): number | null {
  const g = gradeBand.trim();
  const m = /^U-(\d)$/.exec(g);
  if (m) return Number.parseInt(m[1]!, 10);
  if (g === "1-2") return 2;
  if (g === "3-4") return 4;
  if (g === "5-6") return 6;
  return null;
}

export function representativeGradeYearChoicesForBand(gradeBand: string): number[] {
  const max = gradeBandMaxYear(gradeBand);
  if (max != null && max >= 1 && max <= 6) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  return [1, 2, 3, 4, 5, 6];
}

export function gradeYearAllowedForBand(
  gradeBand: string,
  representativeGradeYear: number
): boolean {
  const max = gradeBandMaxYear(gradeBand);
  if (max == null) return true;
  return (
    Number.isInteger(representativeGradeYear) &&
    representativeGradeYear >= 1 &&
    representativeGradeYear <= max
  );
}

export function gradeBandLabelJa(gradeBand: string): string {
  const g = gradeBand.trim();
  const max = gradeBandMaxYear(g);
  if (max != null) return `${max}年生以下`;
  if (g === "1-2") return "1〜2年生";
  if (g === "3-4") return "3〜4年生";
  if (g === "5-6") return "5〜6年生";
  return g || "—";
}
