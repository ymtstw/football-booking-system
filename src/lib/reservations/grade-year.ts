/** 開催日の `grade_band`（MVP: 1-2 / 3-4 / 5-6）から、予約時に選べる学年の一覧 */

export function representativeGradeYearChoicesForBand(gradeBand: string): number[] {
  const g = gradeBand.trim();
  if (g === "1-2") return [1, 2];
  if (g === "3-4") return [3, 4];
  if (g === "5-6") return [5, 6];
  return [1, 2, 3, 4, 5, 6];
}

export function gradeYearLabelJa(year: number): string {
  return `${year}年`;
}
