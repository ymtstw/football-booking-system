/** PATCH /api/admin/matches/[id] 用の純関数検証（同一時刻帯の team 重複など） */

export type SlotTimes = { id: string; phase: string; startTime: string; endTime: string };

/** "HH:MM:SS" を分に変換（同日比較用） */
export function timeToMinutes(t: string): number {
  const s = t.slice(0, 8);
  const parts = s.split(":").map((x) => Number(x));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  return h * 60 + m + sec / 60;
}

export function slotIntervalMinutes(slot: Pick<SlotTimes, "startTime" | "endTime">): [number, number] {
  return [timeToMinutes(slot.startTime), timeToMinutes(slot.endTime)];
}

export function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

export type AssignmentSim = {
  assignmentId: string;
  slotId: string;
  interval: [number, number];
  /** A/B/審判の team_id（審判なしは含めない） */
  teamIds: string[];
};

/**
 * 重なる時間帯の試合間で、同一 team_id が重複していないか。
 * 同一行内の A/B は呼び出し側で別 team を保証すること。
 */
export function overlappingTeamConflict(assignments: AssignmentSim[]): string | null {
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const A = assignments[i]!;
      const B = assignments[j]!;
      if (!intervalsOverlap(A.interval, B.interval)) continue;
      const setA = new Set(A.teamIds);
      for (const tid of B.teamIds) {
        if (setA.has(tid)) {
          return "同一時刻帯に同じチーム（team_id）が重複するため保存できません";
        }
      }
    }
  }
  return null;
}
