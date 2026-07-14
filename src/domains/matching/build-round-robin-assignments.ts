/**
 * V2 総当たり編成（締切後）。
 * - 有効枠に試合を割当。ユニーク対戦を優先し、余り枠は再戦で埋める。
 * - チームごとの試合数差は最大1。
 * - 審判は出場チーム（A/B）のいずれかを割当し、日通しの審判回数を平準化。
 */

import type {
  BuildMatchingMeta,
  BuildMatchingResult,
  RpcAssignmentRow,
  SlotRow,
} from "@/domains/matching/build-matching-assignments";

export type RoundRobinReservationRow = {
  id: string;
};

type PairKey = string;

function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function sortedActiveSlots(slots: SlotRow[]): SlotRow[] {
  return slots
    .filter((s) => s.is_active !== false)
    .slice()
    .sort((a, b) => a.slot_code.localeCompare(b.slot_code, "en"));
}

function allUniquePairs(teamIds: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i]!, teamIds[j]!]);
    }
  }
  return pairs;
}

function playSpreadAfter(
  playCount: Map<string, number>,
  a: string,
  b: string
): number {
  const counts = [...playCount.entries()].map(([id, c]) =>
    id === a || id === b ? c + 1 : c
  );
  if (counts.length === 0) return 0;
  return Math.max(...counts) - Math.min(...counts);
}

function pickPairForSlot(input: {
  teamIds: string[];
  playCount: Map<string, number>;
  pairPlayCount: Map<PairKey, number>;
  preferUnique: boolean;
}): [string, string] | null {
  const { teamIds, playCount, pairPlayCount, preferUnique } = input;
  if (teamIds.length < 2) return null;

  const candidates: Array<[string, string]> = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i]!;
      const b = teamIds[j]!;
      const key = pairKey(a, b);
      const played = pairPlayCount.get(key) ?? 0;
      if (preferUnique && played > 0) continue;
      candidates.push([a, b]);
    }
  }

  if (candidates.length === 0 && preferUnique) {
    return pickPairForSlot({ ...input, preferUnique: false });
  }
  if (candidates.length === 0) return null;

  candidates.sort((p1, p2) => {
    const k1 = pairKey(p1[0], p1[1]);
    const k2 = pairKey(p2[0], p2[1]);
    const rem1 = pairPlayCount.get(k1) ?? 0;
    const rem2 = pairPlayCount.get(k2) ?? 0;
    if (rem1 !== rem2) return rem1 - rem2;

    const spread1 = playSpreadAfter(playCount, p1[0], p1[1]);
    const spread2 = playSpreadAfter(playCount, p2[0], p2[1]);
    if (spread1 !== spread2) return spread1 - spread2;

    const sum1 = (playCount.get(p1[0]) ?? 0) + (playCount.get(p1[1]) ?? 0);
    const sum2 = (playCount.get(p2[0]) ?? 0) + (playCount.get(p2[1]) ?? 0);
    if (sum1 !== sum2) return sum1 - sum2;

    return k1.localeCompare(k2, "en");
  });

  return candidates[0] ?? null;
}

function pickRefereeFromPair(
  a: string,
  b: string,
  refereeCount: Map<string, number>
): string {
  const ra = refereeCount.get(a) ?? 0;
  const rb = refereeCount.get(b) ?? 0;
  if (ra !== rb) return ra < rb ? a : b;
  return a < b ? a : b;
}

export function buildRoundRobinAssignments(input: {
  slots: SlotRow[];
  reservationsActive: RoundRobinReservationRow[];
}): BuildMatchingResult {
  const activeSlots = sortedActiveSlots(input.slots);
  const teamIds = input.reservationsActive
    .map((r) => r.id)
    .slice()
    .sort((a, b) => a.localeCompare(b, "en"));

  const meta: BuildMatchingMeta = {
    unfilledMorningReservationIds: [],
    unfilledAfternoonReservationIds: [],
    targetPlayShortfallReservationIds: [],
    notes: [],
  };

  if (teamIds.length < 2) {
    meta.notes.push("active が2未満のため編成を行いません");
    meta.unfilledMorningReservationIds = [...teamIds];
    meta.unfilledAfternoonReservationIds = [...teamIds];
    return { assignments: [], meta };
  }

  const playCount = new Map<string, number>();
  const pairPlayCount = new Map<PairKey, number>();
  const refereeCount = new Map<string, number>();
  for (const id of teamIds) {
    playCount.set(id, 0);
    refereeCount.set(id, 0);
  }

  const uniquePairs = allUniquePairs(teamIds);
  const assignments: RpcAssignmentRow[] = [];

  for (const slot of activeSlots) {
    const pair = pickPairForSlot({
      teamIds,
      playCount,
      pairPlayCount,
      preferUnique: true,
    });
    if (!pair) {
      meta.notes.push(`枠 ${slot.slot_code} に割当可能なペアがありません`);
      continue;
    }

    const [a, b] = pair;
    const key = pairKey(a, b);
    const rematch = (pairPlayCount.get(key) ?? 0) > 0;
    const spread = playSpreadAfter(playCount, a, b);

    playCount.set(a, (playCount.get(a) ?? 0) + 1);
    playCount.set(b, (playCount.get(b) ?? 0) + 1);
    pairPlayCount.set(key, (pairPlayCount.get(key) ?? 0) + 1);

    const warnings: string[] = [];
    if (rematch) warnings.push("rematch");
    if (spread > 1) warnings.push("match_count_spread_violation");

    assignments.push({
      event_day_slot_id: slot.id,
      match_phase: slot.phase,
      assignment_type: "round_robin",
      reservation_a_id: a,
      reservation_b_id: b,
      referee_reservation_id: null,
      warning_json: warnings,
    });
  }

  // 審判: 全日の試合順に、出場チームのいずれかを割当（回数平準化）
  for (const row of assignments) {
    const ref = pickRefereeFromPair(
      row.reservation_a_id,
      row.reservation_b_id,
      refereeCount
    );
    row.referee_reservation_id = ref;
    refereeCount.set(ref, (refereeCount.get(ref) ?? 0) + 1);
  }

  const minPlay = Math.min(...teamIds.map((id) => playCount.get(id) ?? 0));
  const maxPlay = Math.max(...teamIds.map((id) => playCount.get(id) ?? 0));
  meta.notes.push(
    `総当たり: ${teamIds.length}チーム / ユニーク対戦${uniquePairs.length}本 / 枠${activeSlots.length} / 試合数${minPlay}〜${maxPlay}`
  );

  if (maxPlay - minPlay > 1) {
    for (const id of teamIds) {
      const c = playCount.get(id) ?? 0;
      if (c < minPlay + 1) meta.targetPlayShortfallReservationIds.push(id);
    }
  }

  return { assignments, meta };
}
