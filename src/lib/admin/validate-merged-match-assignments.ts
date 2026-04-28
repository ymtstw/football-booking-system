/**
 * 手動編成調整の「マージ済み割当」検証（単体 PATCH とバッチ保存で共用）
 */

import {
  overlappingTeamConflict,
  slotIntervalMinutes,
  type AssignmentSim,
  type SlotTimes,
} from "@/lib/admin/match-assignment-patch-validation";

export type MergedAsgRow = {
  id: string;
  event_day_slot_id: string;
  match_phase: string;
  reservation_a_id: string;
  reservation_b_id: string;
  referee_reservation_id: string | null;
};

export type SlotShape = {
  id: string;
  phase: string;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

export type ResShape = {
  id: string;
  team_id: string;
  status: string;
};

/** 保存時ブロック：最終状態がルール違反 */
export const ADMIN_MATCH_ADJUST_SAVE_BLOCK =
  "同じチームが複数の試合に入っています。重複しているチームを調整してから保存してください。";

function active(resById: Map<string, ResShape>, rid: string): boolean {
  const r = resById.get(rid);
  return Boolean(r && r.status === "active");
}

/**
 * マージ後の全割当について、PATCH API と同等のルールで検証する。
 * @param originalsById 変更前の行（午前枠の不変チェックに使用）
 */
export function validateMergedMatchAssignments(
  merged: MergedAsgRow[],
  originalsById: Map<string, MergedAsgRow>,
  slotById: Map<string, SlotShape>,
  resById: Map<string, ResShape>
): { ok: true } | { ok: false; message: string } {
  for (const row of merged) {
    const ra = row.reservation_a_id;
    const rb = row.reservation_b_id;
    const ref = row.referee_reservation_id;

    if (ra === rb) {
      return { ok: false, message: ADMIN_MATCH_ADJUST_SAVE_BLOCK };
    }
    if (!active(resById, ra) || !active(resById, rb)) {
      return {
        ok: false,
        message: "A/B には当該開催日の有効（active）な予約のみ指定できます。",
      };
    }
    if (ref != null && !active(resById, ref)) {
      return {
        ok: false,
        message: "審判には当該開催日の有効（active）な予約のみ指定できます。",
      };
    }
    if (ref != null && (ref === ra || ref === rb)) {
      return { ok: false, message: ADMIN_MATCH_ADJUST_SAVE_BLOCK };
    }

    const teamA = resById.get(ra)!.team_id;
    const teamB = resById.get(rb)!.team_id;
    if (teamA === teamB) {
      return { ok: false, message: ADMIN_MATCH_ADJUST_SAVE_BLOCK };
    }
    if (ref != null) {
      const tr = resById.get(ref)!.team_id;
      if (tr === teamA || tr === teamB) {
        return { ok: false, message: ADMIN_MATCH_ADJUST_SAVE_BLOCK };
      }
    }

    const orig = originalsById.get(row.id);
    if (row.match_phase === "morning" && orig && row.event_day_slot_id !== orig.event_day_slot_id) {
      return {
        ok: false,
        message:
          "午前試合の枠は変更できません。予約の希望枠や「対戦表を自動で作成する」でのやり直しで調整してください。",
      };
    }

    const sl = slotById.get(row.event_day_slot_id);
    if (!sl) {
      return { ok: false, message: "指定の枠が開催日に存在しません。" };
    }
    if (sl.is_active === false) {
      return { ok: false, message: "無効な枠には割り当てできません。" };
    }
    if (sl.phase !== row.match_phase) {
      return { ok: false, message: "午前・午後と枠の種類が一致しません。" };
    }
  }

  const afternoonSlotToAssignmentId = new Map<string, string>();
  for (const row of merged) {
    if (row.match_phase !== "afternoon") continue;
    const prev = afternoonSlotToAssignmentId.get(row.event_day_slot_id);
    if (prev != null && prev !== row.id) {
      return {
        ok: false,
        message:
          "午後の同じ枠に複数の試合が重なっています。枠の割り当てを調整してから保存してください。",
      };
    }
    afternoonSlotToAssignmentId.set(row.event_day_slot_id, row.id);
  }

  /** 同一予約IDは複数行に出してよい（午前・午後の別枠など）。重なり時刻の衝突は下の overlappingTeamConflict で検知 */

  const simForOverlap: AssignmentSim[] = [];
  for (const row of merged) {
    const sl = slotById.get(row.event_day_slot_id)!;
    const st: SlotTimes = {
      id: sl.id,
      phase: sl.phase,
      startTime: sl.start_time,
      endTime: sl.end_time,
    };
    const interval = slotIntervalMinutes(st);
    const teamIds: string[] = [
      resById.get(row.reservation_a_id)!.team_id,
      resById.get(row.reservation_b_id)!.team_id,
    ];
    if (row.referee_reservation_id) {
      teamIds.push(resById.get(row.referee_reservation_id)!.team_id);
    }
    simForOverlap.push({
      assignmentId: row.id,
      slotId: row.event_day_slot_id,
      interval,
      teamIds,
    });
  }

  const overlapErr = overlappingTeamConflict(simForOverlap);
  if (overlapErr) {
    return { ok: false, message: overlapErr };
  }

  return { ok: true };
}

/** 開催日内の team_id ごとの「出場試合数」「審判回数」。偏り確認モーダル用 */
export type TeamWorkloadSpread = {
  matchSpread: number;
  refSpread: number;
  matchMin: number;
  matchMax: number;
  refMin: number;
  refMax: number;
  /** いずれかの指標でチーム間の差が 2 以上 */
  needsWorkloadConfirm: boolean;
};

export function computeTeamWorkloadSpread(
  merged: MergedAsgRow[],
  resById: Map<string, ResShape>
): TeamWorkloadSpread {
  const matchCount = new Map<string, number>();
  const refCount = new Map<string, number>();

  for (const row of merged) {
    const ta = resById.get(row.reservation_a_id)?.team_id;
    const tb = resById.get(row.reservation_b_id)?.team_id;
    if (ta) matchCount.set(ta, (matchCount.get(ta) ?? 0) + 1);
    if (tb) matchCount.set(tb, (matchCount.get(tb) ?? 0) + 1);
    const refId = row.referee_reservation_id;
    if (refId) {
      const tr = resById.get(refId)?.team_id;
      if (tr) refCount.set(tr, (refCount.get(tr) ?? 0) + 1);
    }
  }

  const teams = new Set<string>([...matchCount.keys(), ...refCount.keys()]);
  if (teams.size === 0) {
    return {
      matchSpread: 0,
      refSpread: 0,
      matchMin: 0,
      matchMax: 0,
      refMin: 0,
      refMax: 0,
      needsWorkloadConfirm: false,
    };
  }

  const mc = [...teams].map((t) => matchCount.get(t) ?? 0);
  const rc = [...teams].map((t) => refCount.get(t) ?? 0);

  const matchMin = Math.min(...mc);
  const matchMax = Math.max(...mc);
  const refMin = Math.min(...rc);
  const refMax = Math.max(...rc);

  const matchSpread = matchMax - matchMin;
  const refSpread = refMax - refMin;

  return {
    matchSpread,
    refSpread,
    matchMin,
    matchMax,
    refMin,
    refMax,
    needsWorkloadConfirm: matchSpread >= 2 || refSpread >= 2,
  };
}
