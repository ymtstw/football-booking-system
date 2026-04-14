/**
 * 締切後の午前補完・午後編成（design-mvp §5-2〜5-4 に沿った実装）。
 * 確定は DB の admin_apply_matching_run RPC で行う。
 *
 * 【処理の大まかな順序】
 * 1. 午前 `morning_fixed` を現行どおりコピー
 * 2. 午前 `morning_fill` … `morning_fixed` の a/b 以外の active をプールにし、**全探索または貪欲**でペア割当と枠を同時に決める（全日試合数の偏り max−min≤1 を守る。プール大は貪欲）
 * 2b. 空き午前枠が残るとき、**枠優先のフォールバック**（固定外プールのみ・各チーム午前1試合まで）で段階1〜2のみ緩和し `morning_fill` を追加。必要なら希望枠キーのみ段階2相当で再試行。
 * 2c. なお空枠があれば **午前必須埋め**（active 全体から選び、空枠ゼロを最優先。通常の「午前1試合まで」を満たせないときは警告付きで再出場を許容）。
 * 3. 午後は**未使用枠を時間順に1枠ずつ**処理し、毎回 **午後まだ0試合の者**同士の最良辺を active 全体から選ぶ（各チーム午後最大1試合。同日・午前と重なるペアは他候補がある限り除外）
 * 4. 午前試合行に審判を決定（1枠目は次の午前枠の出場者を、2枠目は直前の午前枠の出場者を優先。午前3枠目以降（インデックス≥2）は審判回数等のみ。枠数は `event_day_slots` に追従）
 * 5. 午後行を確定順で出力しつつ審判を決定（全日試合列インデックスに応じた優先ルール）
 *
 * 詳細・係数の意味は `docs/spec/matching-algorithm-impl.md` を参照。
 */

export type RpcAssignmentRow = {
  event_day_slot_id: string;
  match_phase: "morning" | "afternoon";
  assignment_type: "morning_fixed" | "morning_fill" | "afternoon_auto";
  reservation_a_id: string;
  reservation_b_id: string;
  referee_reservation_id: string | null;
  warning_json: string[];
};

export type BuildMatchingMeta = {
  /** 午前でペアにできず残った予約（奇数 singles 等） */
  unfilledMorningReservationIds: string[];
  /** 午後に1試合も割り当てられなかった予約 */
  unfilledAfternoonReservationIds: string[];
  /** 運用メモ（ログ用・短い日本語） */
  notes: string[];
};

export type BuildMatchingResult = {
  assignments: RpcAssignmentRow[];
  meta: BuildMatchingMeta;
};

export type SlotRow = {
  id: string;
  slot_code: string;
  phase: "morning" | "afternoon";
  /** false の枠は編成対象外 */
  is_active?: boolean | null;
};

type TeamRow = {
  strength_category: "strong" | "potential";
};

type ReservationRow = {
  id: string;
  selected_morning_slot_id: string | null;
  team_id: string;
  teams: TeamRow | TeamRow[] | null;
};

type CurrentAssignmentRow = {
  event_day_slot_id: string;
  match_phase: string;
  assignment_type: string;
  reservation_a_id: string;
  reservation_b_id: string;
  referee_reservation_id: string | null;
  warning_json: unknown;
};

/**
 * `morning_fixed` 行のうち、RPC `admin_apply_matching_run` と同じく **active 予約に存在する ID のみ**
 * を編成入力として使う（キャンセル等で消えた予約が a/b/referee に残っている行を落とす）。
 */
function filterMorningFixedEligibleForActive(
  morningFixedRows: CurrentAssignmentRow[],
  activeReservationIds: Set<string>
): CurrentAssignmentRow[] {
  return morningFixedRows.filter((f) => {
    if (!activeReservationIds.has(f.reservation_a_id) || !activeReservationIds.has(f.reservation_b_id)) {
      return false;
    }
    const ref = f.referee_reservation_id;
    if (ref != null && String(ref).trim() !== "" && !activeReservationIds.has(ref)) {
      return false;
    }
    return true;
  });
}

/** 午前で「その枠に1人だけ」いる予約（枠IDと予約IDの対） */
type Single = { slotId: string; reservationId: string };

/** 午後の試合計画（まだ RpcAssignmentRow にはしていない中間形） */
type AfternoonPlan = { slotId: string; a: string; b: string; phase2?: boolean };

/** teams が配列のとき先頭のみ参照（MVP の単一チーム想定） */
function singleTeam(t: TeamRow | TeamRow[] | null | undefined): TeamRow | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

/** 強さカテゴリ（欠損は potential 扱い） */
function strengthOf(r: ReservationRow | undefined): "strong" | "potential" {
  return singleTeam(r?.teams)?.strength_category ?? "potential";
}

/** 午前→午後、同一 phase 内は slot_code で並べ替え用のキー */
function slotOrderKey(s: SlotRow): string {
  return `${s.phase === "morning" ? "0" : "1"}${s.slot_code}`;
}

/** 無向グラフに辺を1本追加（午前の「すでに対戦した」判定用） */
function addUndirectedEdge(map: Map<string, Set<string>>, a: string, b: string): void {
  if (a === b) return;
  if (!map.has(a)) map.set(a, new Set());
  if (!map.has(b)) map.set(b, new Set());
  map.get(a)!.add(b);
  map.get(b)!.add(a);
}

/** 無向グラフから辺を1本削除（午前探索のバックトラック用） */
function removeUndirectedEdge(map: Map<string, Set<string>>, a: string, b: string): void {
  if (a === b) return;
  map.get(a)?.delete(b);
  map.get(b)?.delete(a);
}

function cloneMorningEdge(src: Map<string, Set<string>>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, v] of src) out.set(k, new Set(v));
  return out;
}

/** 無向グラフ上で a と b が隣接（＝午前で既に対戦済み）か */
function areAdjacent(map: Map<string, Set<string>>, a: string, b: string): boolean {
  return map.get(a)?.has(b) ?? false;
}

/** 午前の対戦辺（fixed + fill） */
function morningEdgesFromRows(rows: RpcAssignmentRow[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.match_phase !== "morning") continue;
    addUndirectedEdge(m, row.reservation_a_id, row.reservation_b_id);
  }
  return m;
}

/**
 * 同日の対戦回数（重み付きマップ）。
 * 警告 duplicate_opponent 用。午後出力ループでは「午前のみ」から再構築してから積み上げる。
 */
function sameDayOpponentCount(
  edges: Map<string, Map<string, number>>,
  a: string,
  b: string
): number {
  return edges.get(a)?.get(b) ?? 0;
}

/** 午前で既に当たった、または同日ですでに1回以上当たっている（午後計画上の重複回避用） */
function afternoonPairIsDuplicate(
  ra: string,
  rb: string,
  morningEdge: Map<string, Set<string>>,
  dayOpponentCount: Map<string, Map<string, number>>
): boolean {
  return areAdjacent(morningEdge, ra, rb) || sameDayOpponentCount(dayOpponentCount, ra, rb) >= 1;
}

/** 同日対戦回数を +1（対称に両側更新） */
function bumpOpponentCount(edges: Map<string, Map<string, number>>, a: string, b: string): void {
  if (a === b) return;
  if (!edges.has(a)) edges.set(a, new Map());
  if (!edges.has(b)) edges.set(b, new Map());
  const ma = edges.get(a)!;
  const mb = edges.get(b)!;
  ma.set(b, (ma.get(b) ?? 0) + 1);
  mb.set(a, (mb.get(a) ?? 0) + 1);
}

/** `bumpOpponentCount` の逆（DFS 用のロールバック） */
function unbumpOpponentCount(edges: Map<string, Map<string, number>>, a: string, b: string): void {
  if (a === b) return;
  const ma = edges.get(a);
  const mb = edges.get(b);
  if (!ma || !mb) return;
  const ca = (ma.get(b) ?? 0) - 1;
  const cb = (mb.get(a) ?? 0) - 1;
  if (ca <= 0) ma.delete(b);
  else ma.set(b, ca);
  if (cb <= 0) mb.delete(a);
  else mb.set(a, cb);
}

function cloneDayOpponentCount(src: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [k, m] of src) {
    out.set(k, new Map(m));
  }
  return out;
}

/** active ごとの strong / potential 人数がどちらも偶数か */
function activeEvenCountsPerStrengthCategory(activeIds: string[], byRes: Map<string, ReservationRow>): boolean {
  let strong = 0;
  let pot = 0;
  for (const id of activeIds) {
    if (strengthOf(byRes.get(id)) === "strong") strong += 1;
    else pot += 1;
  }
  return strong % 2 === 0 && pot % 2 === 0;
}

/**
 * 残り `remainingSlots` 本を、同カテゴリペアのみ・重複回避（現状の duplicate 定義）・各 active の午後あと枠（`afternoonMaxPerPlayer−午後試合数`）で埋められるか。
 * アクティブ各カテゴリ偶数は呼び出し側で別チェック。
 */
function canFillRemainingAfternoonWithIntraCategoryOnly(
  activeIds: string[],
  byRes: Map<string, ReservationRow>,
  afternoonCount: Map<string, number>,
  dayOpponentCount: Map<string, Map<string, number>>,
  morningEdge: Map<string, Set<string>>,
  remainingSlots: number,
  afternoonMaxPerPlayer: number
): boolean {
  if (remainingSlots <= 0) return true;

  const caps = new Map<string, number>();
  for (const id of activeIds) {
    caps.set(id, Math.max(0, afternoonMaxPerPlayer - (afternoonCount.get(id) ?? 0)));
  }

  const dup = cloneDayOpponentCount(dayOpponentCount);
  const sorted = [...activeIds].sort((a, b) => a.localeCompare(b));

  const sameStrength = (x: string, y: string) => strengthOf(byRes.get(x)) === strengthOf(byRes.get(y));

  function dfs(left: number): boolean {
    if (left === 0) return true;
    for (let i = 0; i < sorted.length; i++) {
      const ra = sorted[i]!;
      if ((caps.get(ra) ?? 0) < 1) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        const rb = sorted[j]!;
        if ((caps.get(rb) ?? 0) < 1) continue;
        if (!sameStrength(ra, rb)) continue;
        if (afternoonPairIsDuplicate(ra, rb, morningEdge, dup)) continue;

        bumpOpponentCount(dup, ra, rb);
        caps.set(ra, (caps.get(ra) ?? 0) - 1);
        caps.set(rb, (caps.get(rb) ?? 0) - 1);

        if (dfs(left - 1)) return true;

        caps.set(ra, (caps.get(ra) ?? 0) + 1);
        caps.set(rb, (caps.get(rb) ?? 0) + 1);
        unbumpOpponentCount(dup, ra, rb);
      }
    }
    return false;
  }

  return dfs(remainingSlots);
}

/** 当日累計出場の偏りを抑える係数（午前ペア用） */
const PLAY_COUNT_BALANCE_WEIGHT = 4;
/** 同日で既に対戦済みのペアを選ぶスコアペナルティ（他候補が無いときのみ選ばれる程度に大きくする） */
const DUPLICATE_OPPONENT_SCORE_PENALTY = 1000;

/** 1試合目: 2試合目以外から審判に回したときのペナルティ（審判回数平準化が勝ちやすい程度） */
const REFEREE_NOT_FROM_SECOND_MATCH_PENALTY = 24;
/** 2試合目以降: 「次の試合に出ない」候補以外のペナルティ */
const REFEREE_NOT_IDLE_BEFORE_NEXT_PENALTY = 10;
/** 直前の試合と同じ予約が連続で審判になることを避ける */
const REFEREE_CONSECUTIVE_SAME_PENALTY = 40;
/** 予約が行に出場（a または b）した回数（午前の偏りを減らすための係数に使用） */
function playerMatchCount(rows: RpcAssignmentRow[], rid: string): number {
  let n = 0;
  for (const row of rows) {
    if (row.reservation_a_id === rid || row.reservation_b_id === rid) n += 1;
  }
  return n;
}

/** 午前フェーズのみの出場回数（未ペア判定・フォールバックで利用。各チーム午前1試合まで） */
function playerMorningMatchCount(rows: RpcAssignmentRow[], rid: string): number {
  let n = 0;
  for (const row of rows) {
    if (row.match_phase !== "morning") continue;
    if (row.reservation_a_id === rid || row.reservation_b_id === rid) n += 1;
  }
  return n;
}

/** 当該枠に午前の試合行が付いているか（1枠1行想定） */
function morningSlotHasAssignment(rows: RpcAssignmentRow[], slotId: string): boolean {
  return rows.some((r) => r.match_phase === "morning" && r.event_day_slot_id === slotId);
}

/** 現時点の `rows`（午前＋午後）から active ごとの試合出場回数 */
function buildPlayCountsFromRows(rows: RpcAssignmentRow[], activeIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of activeIds) m.set(id, 0);
  for (const row of rows) {
    m.set(row.reservation_a_id, (m.get(row.reservation_a_id) ?? 0) + 1);
    m.set(row.reservation_b_id, (m.get(row.reservation_b_id) ?? 0) + 1);
  }
  return m;
}

/**
 * `baseCounts` の上で a,b が各 +1 試合したあと、active 間の max(試合数)−min が 1 以下か。
 * 全日で「誰かが2試合以上多い」状態を避ける（1試合差までは許容）。
 */
function playCountSpreadOkAfterAddingOne(
  baseCounts: Map<string, number>,
  activeIds: string[],
  a: string,
  b: string
): boolean {
  if (activeIds.length === 0) return true;
  let mi = Infinity;
  let ma = -Infinity;
  for (const id of activeIds) {
    let c = baseCounts.get(id) ?? 0;
    if (id === a || id === b) c += 1;
    if (c < mi) mi = c;
    if (c > ma) ma = c;
  }
  return ma - mi <= 1;
}

/** 全日試合数の max−min（検証・メモ用） */
function playCountSpreadForActiveRows(rows: RpcAssignmentRow[], activeIds: string[]): number {
  if (activeIds.length === 0) return 0;
  const vals = activeIds.map((id) => playerMatchCount(rows, id));
  return Math.max(...vals) - Math.min(...vals);
}

/** 午前→午後の枠を1列にしたときのグローバル index（0 始まり） */
function buildGlobalSlotIndex(morningSlots: SlotRow[], afternoonSlots: SlotRow[]): Map<string, number> {
  const order = [...morningSlots.map((s) => s.id), ...afternoonSlots.map((s) => s.id)];
  return new Map(order.map((id, i) => [id, i]));
}

function lastGlobalPlayIndex(
  rid: string,
  rows: RpcAssignmentRow[],
  planned: AfternoonPlan[],
  globalIndex: Map<string, number>
): number {
  let best = -1;
  for (const row of rows) {
    if (row.reservation_a_id !== rid && row.reservation_b_id !== rid) continue;
    const g = globalIndex.get(row.event_day_slot_id);
    if (g !== undefined && g > best) best = g;
  }
  for (const p of planned) {
    if (p.a !== rid && p.b !== rid) continue;
    const g = globalIndex.get(p.slotId);
    if (g !== undefined && g > best) best = g;
  }
  return best;
}

/** 直前の出場枠の「次の枠」にまた出る＝連続出場のハード回避用 */
function isHardConsecutivePlay(
  rid: string,
  nextSlotId: string,
  rows: RpcAssignmentRow[],
  planned: AfternoonPlan[],
  globalIndex: Map<string, number>
): boolean {
  const g = globalIndex.get(nextSlotId);
  if (g === undefined) return false;
  const last = lastGlobalPlayIndex(rid, rows, planned, globalIndex);
  if (last < 0) return false;
  return g - last === 1;
}

/** 直前出場からの枠 gap（未出場は理想 gap 扱いでソフトペナルティ 0） */
function playGapForSlot(
  rid: string,
  nextSlotId: string,
  rows: RpcAssignmentRow[],
  planned: AfternoonPlan[],
  globalIndex: Map<string, number>
): number {
  const g = globalIndex.get(nextSlotId);
  if (g === undefined) return 3;
  const last = lastGlobalPlayIndex(rid, rows, planned, globalIndex);
  if (last < 0) return 2;
  return g - last;
}

/** gap=2（1枠空き）を理想に、連続に近いほど重く・空き過ぎも軽くペナルティ */
function slotGapSoftPenalty(gap: number): number {
  if (gap <= 1) return 70;
  if (gap === 2) return 0;
  if (gap <= 5) return (gap - 2) * 3;
  return 9 + (gap - 5) * 1;
}

/** 審判として割り当てられた回数（審判負担の平準化） */
function refereeCount(rows: RpcAssignmentRow[], rid: string): number {
  let n = 0;
  for (const row of rows) {
    if (row.referee_reservation_id === rid) n += 1;
  }
  return n;
}

/**
 * 午前ペアのスコア（小さいほど良い）。
 * - カテゴリ不一致: +5
 * - 午前ですでに対戦辺がある: +DUPLICATE_OPPONENT_SCORE_PENALTY（同日重複回避を最優先）
 * - 出場回数の和: 全体の試合数を抑えたい方向
 * - 出場回数の差: 午前だけでも「多い人同士／少ない人同士」より、差が小さくなる組を優先
 */
function scoreMorningPair(
  ra: string,
  rb: string,
  byRes: Map<string, ReservationRow>,
  morningEdge: Map<string, Set<string>>,
  rows: RpcAssignmentRow[]
): number {
  let s = 0;
  if (strengthOf(byRes.get(ra)) !== strengthOf(byRes.get(rb))) s += 5;
  if (areAdjacent(morningEdge, ra, rb)) s += DUPLICATE_OPPONENT_SCORE_PENALTY;
  const ca = playerMatchCount(rows, ra);
  const cb = playerMatchCount(rows, rb);
  s += ca + cb;
  s += PLAY_COUNT_BALANCE_WEIGHT * Math.abs(ca - cb);
  return s;
}

/**
 * 希望枠の並びキー（未定義枠は末尾扱いで安定化）
 */
function morningSlotOrderKeyForId(slotId: string, slotById: Map<string, SlotRow>): string {
  const row = slotById.get(slotId);
  return row ? slotOrderKey(row) : `9${slotId}`;
}

/** 希望枠が取れないときは singles の所在枠で代替（通常は希望と一致） */
function effectiveMorningPrefSlotId(s: Single, byRes: Map<string, ReservationRow>): string {
  const r = byRes.get(s.reservationId);
  return r?.selected_morning_slot_id ?? s.slotId;
}

/**
 * ペアに割り当てる午前枠ID。
 * 各チームの希望枠**より前**の枠には試合を置かない → 二人の希望のうち **枠順で遅い方**（キーが大きい方）の枠に置く。
 * 0人枠への割当は午前全探索の候補枠（希望以降の空枠）から選ぶ。
 */
function morningSlotForPairForSingles(
  a: Single,
  b: Single,
  byRes: Map<string, ReservationRow>,
  slotById: Map<string, SlotRow>
): string {
  if (a.slotId === b.slotId) return a.slotId;
  const pa = effectiveMorningPrefSlotId(a, byRes);
  const pb = effectiveMorningPrefSlotId(b, byRes);
  if (pa === pb) return pa;
  const ka = morningSlotOrderKeyForId(pa, slotById);
  const kb = morningSlotOrderKeyForId(pb, slotById);
  if (ka.localeCompare(kb) > 0) return pa;
  if (ka.localeCompare(kb) < 0) return pb;
  return a.reservationId.localeCompare(b.reservationId) <= 0 ? pa : pb;
}

/** 希望より前に置かないためのキー（単独は Single、固定側は希望なければ固定枠IDで代替） */
function morningPrefOrderKeyForReservation(
  rid: string,
  single: Single | undefined,
  slotFallbackWhenNoPref: string | null,
  byRes: Map<string, ReservationRow>,
  slotById: Map<string, SlotRow>
): string {
  let slotId: string;
  if (single) {
    slotId = effectiveMorningPrefSlotId(single, byRes);
  } else {
    const r = byRes.get(rid);
    slotId = r?.selected_morning_slot_id ?? slotFallbackWhenNoPref ?? "";
  }
  return morningSlotOrderKeyForId(slotId, slotById);
}

/** `morning_fill` 1 本分の候補（固定外プールのみ） */
type MorningFillAtom = { a: string; b: string; slotId: string };

function dedupeSinglesByReservationId(list: Single[]): Single[] {
  const m = new Map<string, Single>();
  for (const s of list) m.set(s.reservationId, s);
  return [...m.keys()].sort((a, b) => a.localeCompare(b)).map((id) => m.get(id)!);
}

function morningMatchSlotRespectsPrefs(
  matchSlotId: string,
  a: string,
  b: string,
  sA: Single,
  sB: Single,
  byRes: Map<string, ReservationRow>,
  slotById: Map<string, SlotRow>
): boolean {
  const km = morningSlotOrderKeyForId(matchSlotId, slotById);
  const ka = morningPrefOrderKeyForReservation(a, sA, null, byRes, slotById);
  const kb = morningPrefOrderKeyForReservation(b, sB, null, byRes, slotById);
  return km.localeCompare(ka) >= 0 && km.localeCompare(kb) >= 0;
}

/**
 * 午前全探索でペアあたり列挙する候補枠数の上限。
 * 既定4枠以上や将来の枠増でも取りこぼしが出ないよう `morningSlots` 本数に比例させ、DFS 分岐は上限で抑える。
 */
function morningFillSlotCandidateCap(activeMorningSlotCount: number): number {
  return Math.min(64, Math.max(16, activeMorningSlotCount * 3 + 4));
}

/** ペア (a,b) に割り当て可能な午前枠 ID（希望より前に置かない・固定枠は不可・未使用のみ） */
function feasibleMorningFillSlotCandidates(
  a: string,
  b: string,
  singleById: Map<string, Single>,
  usedSlots: Set<string>,
  fixedSlotIds: Set<string>,
  morningEdge: Map<string, Set<string>>,
  byRes: Map<string, ReservationRow>,
  slotById: Map<string, SlotRow>,
  morningSlotsOrdered: SlotRow[],
  maxCandidates: number
): string[] {
  if (areAdjacent(morningEdge, a, b)) return [];
  const sA = singleById.get(a);
  const sB = singleById.get(b);
  if (!sA || !sB) return [];
  const primary = morningSlotForPairForSingles(sA, sB, byRes, slotById);
  const out: string[] = [];
  const push = (sid: string) => {
    if (!sid || fixedSlotIds.has(sid) || usedSlots.has(sid)) return;
    if (!morningMatchSlotRespectsPrefs(sid, a, b, sA, sB, byRes, slotById)) return;
    if (!out.includes(sid)) out.push(sid);
  };
  push(primary);
  const pa = effectiveMorningPrefSlotId(sA, byRes);
  const pb = effectiveMorningPrefSlotId(sB, byRes);
  const ka = morningSlotOrderKeyForId(pa, slotById);
  const kb = morningSlotOrderKeyForId(pb, slotById);
  const needKey = ka.localeCompare(kb) >= 0 ? ka : kb;
  // 希望1人以上の枠も候補に含める（0人枠のみだと primary 失敗時に詰むため）
  for (const slot of morningSlotsOrdered) {
    if (!slot.id || fixedSlotIds.has(slot.id) || usedSlots.has(slot.id)) continue;
    const ks = morningSlotOrderKeyForId(slot.id, slotById);
    if (ks.localeCompare(needKey) < 0) continue;
    push(slot.id);
    if (out.length >= maxCandidates) break;
  }
  out.sort(
    (x, y) =>
      morningSlotOrderKeyForId(x, slotById).localeCompare(morningSlotOrderKeyForId(y, slotById)) ||
      x.localeCompare(y)
  );
  return out.slice(0, maxCandidates);
}

function morningHopeCoverageCount(
  fills: MorningFillAtom[],
  fixedFromCurrent: CurrentAssignmentRow[],
  hopeMorningSlotIds: Set<string>
): number {
  const covered = new Set<string>();
  for (const f of fixedFromCurrent) covered.add(f.event_day_slot_id);
  for (const x of fills) covered.add(x.slotId);
  let n = 0;
  for (const h of hopeMorningSlotIds) {
    if (covered.has(h)) n += 1;
  }
  return n;
}

function morningFillPlanMetrics(
  fills: MorningFillAtom[],
  fixedRows: RpcAssignmentRow[],
  morningEdgeBase: Map<string, Set<string>>,
  byRes: Map<string, ReservationRow>,
  hopeMorningSlotIds: Set<string>,
  fixedFromCurrent: CurrentAssignmentRow[]
): {
  nPairs: number;
  hopeCover: number;
  crossCat: number;
  dupPenalty: number;
  balance: number;
} {
  const nPairs = fills.length;
  const hopeCover = morningHopeCoverageCount(fills, fixedFromCurrent, hopeMorningSlotIds);
  let crossCat = 0;
  let dupPenalty = 0;
  let balance = 0;
  const edge = cloneMorningEdge(morningEdgeBase);
  for (const f of fills) {
    if (strengthOf(byRes.get(f.a)) !== strengthOf(byRes.get(f.b))) crossCat += 1;
    if (areAdjacent(edge, f.a, f.b)) dupPenalty += 1;
    balance += scoreMorningPair(f.a, f.b, byRes, edge, fixedRows);
    addUndirectedEdge(edge, f.a, f.b);
  }
  return { nPairs, hopeCover, crossCat, dupPenalty, balance };
}

function morningFillPlanTieKey(fills: MorningFillAtom[]): string {
  return [...fills]
    .map((f) => {
      const x = f.a.localeCompare(f.b) <= 0 ? f.a : f.b;
      const y = f.a.localeCompare(f.b) <= 0 ? f.b : f.a;
      return `${f.slotId}\0${x}\0${y}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function morningFillPlanIsBetter(
  cand: MorningFillAtom[],
  best: MorningFillAtom[] | null,
  fixedRows: RpcAssignmentRow[],
  morningEdgeBase: Map<string, Set<string>>,
  byRes: Map<string, ReservationRow>,
  hopeMorningSlotIds: Set<string>,
  fixedFromCurrent: CurrentAssignmentRow[]
): boolean {
  if (best === null) return true;
  const mc = morningFillPlanMetrics(cand, fixedRows, morningEdgeBase, byRes, hopeMorningSlotIds, fixedFromCurrent);
  const mb = morningFillPlanMetrics(best, fixedRows, morningEdgeBase, byRes, hopeMorningSlotIds, fixedFromCurrent);
  if (mc.nPairs !== mb.nPairs) return mc.nPairs > mb.nPairs;
  if (mc.hopeCover !== mb.hopeCover) return mc.hopeCover > mb.hopeCover;
  if (mc.crossCat !== mb.crossCat) return mc.crossCat < mb.crossCat;
  if (mc.dupPenalty !== mb.dupPenalty) return mc.dupPenalty < mb.dupPenalty;
  if (mc.balance !== mb.balance) return mc.balance < mb.balance;
  return morningFillPlanTieKey(cand).localeCompare(morningFillPlanTieKey(best)) < 0;
}

/** プールがこの人数を超えると午前全探索の分岐が大きくなるため、貪欲に切り替える */
const MORNING_FILL_DFS_POOL_MAX = 10;

/**
 * 固定外プールの `morning_fill` を貪欲に積む（大人数時の代替。全日試合数の偏りは 1 以内を守る）。
 */
function greedyMorningFillPlan(params: {
  poolIds: string[];
  activeIds: string[];
  singleById: Map<string, Single>;
  morningEdgeBase: Map<string, Set<string>>;
  fixedRows: RpcAssignmentRow[];
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  fixedSlotIds: Set<string>;
  morningSlotsOrdered: SlotRow[];
}): MorningFillAtom[] {
  const {
    poolIds,
    activeIds,
    singleById,
    morningEdgeBase,
    fixedRows,
    byRes,
    slotById,
    fixedSlotIds,
    morningSlotsOrdered,
  } = params;

  const chosen: MorningFillAtom[] = [];
  const usedSlots = new Set<string>();
  const edge = cloneMorningEdge(morningEdgeBase);
  const playCounts = buildPlayCountsFromRows(fixedRows, activeIds);
  let remaining = [...poolIds].sort((a, b) => a.localeCompare(b));

  const cap = morningFillSlotCandidateCap(morningSlotsOrdered.length);

  while (remaining.length >= 2) {
    let progressed = false;
    outer: for (let vi = 0; vi < remaining.length; vi++) {
      const v = remaining[vi]!;
      for (let ui = vi + 1; ui < remaining.length; ui++) {
        const u = remaining[ui]!;
        if (areAdjacent(edge, v, u)) continue;
        const slots = feasibleMorningFillSlotCandidates(
          v,
          u,
          singleById,
          usedSlots,
          fixedSlotIds,
          edge,
          byRes,
          slotById,
          morningSlotsOrdered,
          cap
        );
        for (const slotId of slots) {
          const a = v.localeCompare(u) <= 0 ? v : u;
          const b = v.localeCompare(u) <= 0 ? u : v;
          if (!playCountSpreadOkAfterAddingOne(playCounts, activeIds, a, b)) continue;
          chosen.push({ a, b, slotId });
          usedSlots.add(slotId);
          addUndirectedEdge(edge, v, u);
          playCounts.set(a, (playCounts.get(a) ?? 0) + 1);
          playCounts.set(b, (playCounts.get(b) ?? 0) + 1);
          remaining = remaining.filter((id) => id !== v && id !== u);
          progressed = true;
          break outer;
        }
      }
    }
    if (!progressed) break;
  }

  return chosen;
}

/**
 * 固定外プールの `morning_fill` を全探索で決める（プール小規模想定。大きいときは貪欲）。
 * 優先: (1) 試合本数最大化 (2) 希望者がいる午前枠のカバー最大化 (3) 同カテゴリ (4) 未対戦 (5) 出場バランス
 * 枝: 全日試合数の max−min が 1 を超えない組み合わせのみ（`activeIds` 基準）。
 */
function searchOptimalMorningFillPlan(params: {
  poolIds: string[];
  activeIds: string[];
  singleById: Map<string, Single>;
  morningEdgeBase: Map<string, Set<string>>;
  fixedRows: RpcAssignmentRow[];
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  fixedSlotIds: Set<string>;
  morningSlotsOrdered: SlotRow[];
  hopeMorningSlotIds: Set<string>;
  fixedFromCurrent: CurrentAssignmentRow[];
}): MorningFillAtom[] {
  const {
    poolIds,
    activeIds,
    singleById,
    morningEdgeBase,
    fixedRows,
    byRes,
    slotById,
    fixedSlotIds,
    morningSlotsOrdered,
    hopeMorningSlotIds,
    fixedFromCurrent,
  } = params;

  let bestPlan: MorningFillAtom[] | null = null;
  let bestMaxPairs = -1;

  const chosen: MorningFillAtom[] = [];
  const usedSlots = new Set<string>();
  const edge = cloneMorningEdge(morningEdgeBase);
  const playCounts = buildPlayCountsFromRows(fixedRows, activeIds);

  const maxPairsUpperBound = (rem: number) => chosen.length + Math.floor(rem / 2);

  function dfs(remaining: string[]) {
    const ub = maxPairsUpperBound(remaining.length);
    if (bestPlan !== null && ub < bestMaxPairs) return;

    if (remaining.length === 0) {
      if (
        bestPlan === null ||
        morningFillPlanIsBetter(
          chosen,
          bestPlan,
          fixedRows,
          morningEdgeBase,
          byRes,
          hopeMorningSlotIds,
          fixedFromCurrent
        )
      ) {
        bestPlan = chosen.map((c) => ({ ...c }));
        bestMaxPairs = bestPlan.length;
      }
      return;
    }

    const v = remaining[0]!;
    const rest = remaining.slice(1);

    dfs(rest);

    for (let i = 0; i < rest.length; i++) {
      const u = rest[i]!;
      const rem2 = rest.filter((_, j) => j !== i);
      if (areAdjacent(edge, v, u)) continue;
      const slots = feasibleMorningFillSlotCandidates(
        v,
        u,
        singleById,
        usedSlots,
        fixedSlotIds,
        edge,
        byRes,
        slotById,
        morningSlotsOrdered,
        morningFillSlotCandidateCap(morningSlotsOrdered.length)
      );
      for (const slotId of slots) {
        const a = v.localeCompare(u) <= 0 ? v : u;
        const b = v.localeCompare(u) <= 0 ? u : v;
        if (!playCountSpreadOkAfterAddingOne(playCounts, activeIds, a, b)) continue;
        chosen.push({ a, b, slotId });
        usedSlots.add(slotId);
        addUndirectedEdge(edge, v, u);
        playCounts.set(a, (playCounts.get(a) ?? 0) + 1);
        playCounts.set(b, (playCounts.get(b) ?? 0) + 1);
        dfs(rem2);
        playCounts.set(a, (playCounts.get(a) ?? 0) - 1);
        playCounts.set(b, (playCounts.get(b) ?? 0) - 1);
        removeUndirectedEdge(edge, v, u);
        usedSlots.delete(slotId);
        chosen.pop();
      }
    }
  }

  dfs(poolIds);
  return bestPlan ?? [];
}

/** 午前枠埋めフォールバックの段階（1〜2のみ。候補は常に固定外プール・午前1試合まで） */
type MorningFallbackStage = 1 | 2;

function getSingleForMorningFallback(
  rid: string,
  singleById: Map<string, Single>,
  byRes: Map<string, ReservationRow>,
  morningSlotIdSet: Set<string>,
  fallbackSlotId: string
): Single | undefined {
  const ex = singleById.get(rid);
  if (ex) return ex;
  const r = byRes.get(rid);
  if (!r) return undefined;
  const sid =
    r.selected_morning_slot_id && morningSlotIdSet.has(r.selected_morning_slot_id)
      ? r.selected_morning_slot_id
      : fallbackSlotId;
  return { reservationId: rid, slotId: sid };
}

function pickMorningFallbackPairForSlot(params: {
  slotId: string;
  stage: MorningFallbackStage;
  relaxPrefs: boolean;
  rows: RpcAssignmentRow[];
  morningEdge: Map<string, Set<string>>;
  singleById: Map<string, Single>;
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  morningSlotIdSet: Set<string>;
  fallbackSlotId: string;
  poolIds: string[];
  activeIds: string[];
}): { a: string; b: string } | null {
  const {
    slotId,
    stage,
    relaxPrefs,
    rows,
    morningEdge,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
    poolIds,
    activeIds,
  } = params;

  const baseCounts = buildPlayCountsFromRows(rows, activeIds);

  const ids = [...poolIds]
    .sort((a, b) => a.localeCompare(b))
    .filter((id) => playerMorningMatchCount(rows, id) < 1);
  if (ids.length < 2) return null;

  type Cand = { a: string; b: string; score: number; tie: string };
  let best: Cand | null = null;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a0 = ids[i]!;
      const b0 = ids[j]!;
      if (stage < 2 && areAdjacent(morningEdge, a0, b0)) continue;

      const sA = getSingleForMorningFallback(a0, singleById, byRes, morningSlotIdSet, fallbackSlotId);
      const sB = getSingleForMorningFallback(b0, singleById, byRes, morningSlotIdSet, fallbackSlotId);
      if (!sA || !sB) continue;

      if (!relaxPrefs && !morningMatchSlotRespectsPrefs(slotId, a0, b0, sA, sB, byRes, slotById)) {
        continue;
      }

      let score = 0;
      // 段階1以降は同カテゴリ優先をスコアに含めない（異カテゴリでも同等扱い）
      if (stage >= 2 && areAdjacent(morningEdge, a0, b0)) score += 80;
      score += playerMatchCount(rows, a0) + playerMatchCount(rows, b0);

      const xa = a0.localeCompare(b0) <= 0 ? a0 : b0;
      const xb = a0.localeCompare(b0) <= 0 ? b0 : a0;
      if (!playCountSpreadOkAfterAddingOne(baseCounts, activeIds, xa, xb)) continue;
      const tie = `${xa}\0${xb}`;

      if (
        best === null ||
        score < best.score ||
        (score === best.score && tie.localeCompare(best.tie) < 0)
      ) {
        best = { a: xa, b: xb, score, tie };
      }
    }
  }

  if (!best) return null;
  return { a: best.a, b: best.b };
}

/** 全探索後も空枠またはプール未出場が残るとき、枠優先で `morning_fill` を追加する */
function applyMorningSlotFillFallback(params: {
  rows: RpcAssignmentRow[];
  morningEdge: Map<string, Set<string>>;
  morningSlots: SlotRow[];
  fixedSlotIds: Set<string>;
  singleById: Map<string, Single>;
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  morningSlotIdSet: Set<string>;
  fallbackSlotId: string;
  poolIds: string[];
  activeIds: string[];
  notes: string[];
}): void {
  const {
    rows,
    morningEdge,
    morningSlots,
    fixedSlotIds,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
    poolIds,
    activeIds,
    notes,
  } = params;

  const hasEmptySlot = (): boolean =>
    morningSlots.some(
      (s) => s.id && !fixedSlotIds.has(s.id) && !morningSlotHasAssignment(rows, s.id)
    );

  // 行を足せるのは空枠があるときのみ（未ペアだけでは枠が無ければ追加不可）
  if (!hasEmptySlot()) return;

  const maxSteps = Math.max(32, morningSlots.length * (poolIds.length + 4));
  let steps = 0;

  const listEmptySlotIds = (): string[] =>
    morningSlots
      .filter((s) => s.id && !fixedSlotIds.has(s.id) && !morningSlotHasAssignment(rows, s.id))
      .sort((s1, s2) => slotOrderKey(s1).localeCompare(slotOrderKey(s2)))
      .map((s) => s.id);

  const tryOneFill = (stage: MorningFallbackStage, relaxPrefs: boolean): boolean => {
    const emptySlotIds = listEmptySlotIds();
    if (emptySlotIds.length === 0) return false;
    for (const slotId of emptySlotIds) {
      const pair = pickMorningFallbackPairForSlot({
        slotId,
        stage,
        relaxPrefs,
        rows,
        morningEdge,
        singleById,
        byRes,
        slotById,
        morningSlotIdSet,
        fallbackSlotId,
        poolIds,
        activeIds,
      });
      if (!pair) continue;

      const w: string[] = ["morning_fallback_fill", `morning_fallback_stage_${stage}`];
      if (relaxPrefs) w.push("morning_fallback_relaxed_prefs");
      if (strengthOf(byRes.get(pair.a)) !== strengthOf(byRes.get(pair.b))) w.push("cross_category_match");
      if (areAdjacent(morningEdge, pair.a, pair.b)) w.push("duplicate_opponent");

      rows.push({
        event_day_slot_id: slotId,
        match_phase: "morning",
        assignment_type: "morning_fill",
        reservation_a_id: pair.a,
        reservation_b_id: pair.b,
        referee_reservation_id: null,
        warning_json: [...new Set(w)],
      });
      addUndirectedEdge(morningEdge, pair.a, pair.b);
      notes.push(
        `午前枠埋めフォールバック（段階${stage}${relaxPrefs ? "・希望枠キー緩和" : ""}）: 枠 ${slotId}`
      );
      return true;
    }
    return false;
  };

  notes.push("午前: 全探索後に空枠／未出場が残ったため枠優先フォールバックを試行");

  for (let stage = 1 as MorningFallbackStage; stage <= 2; stage++) {
    while (steps < maxSteps && listEmptySlotIds().length > 0) {
      steps += 1;
      if (!tryOneFill(stage, false)) break;
    }
    if (listEmptySlotIds().length === 0) return;
  }

  // 希望枠順キーのみ緩和（段階2と同じ: プール・午前1試合・既対戦はスコアで劣後）
  while (steps < maxSteps && listEmptySlotIds().length > 0) {
    steps += 1;
    if (!tryOneFill(2, true)) break;
  }
}

/**
 * 非固定の午前枠にまだ行が無いとき、**空枠を無くす**ことを最優先して `morning_fill` を追加する。
 * 通常の「各チーム午前1試合まで」では埋まらない場合（例: 有効午前枠が4・activeが6）に、警告付きで **午前の再出場** を許容する。
 */
function pickMorningMandatoryPairForEmptySlot(params: {
  slotId: string;
  relaxPrefs: boolean;
  requireSpreadOk: boolean;
  rows: RpcAssignmentRow[];
  morningEdge: Map<string, Set<string>>;
  activeIds: string[];
  singleById: Map<string, Single>;
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  morningSlotIdSet: Set<string>;
  fallbackSlotId: string;
}): { a: string; b: string } | null {
  const {
    slotId,
    relaxPrefs,
    requireSpreadOk,
    rows,
    morningEdge,
    activeIds,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
  } = params;

  const sorted = [...activeIds].sort((a, b) => a.localeCompare(b));
  if (sorted.length < 2) return null;

  const baseCounts = buildPlayCountsFromRows(rows, activeIds);

  type Cand = { a: string; b: string; score: number; tie: string };
  let best: Cand | null = null;

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a0 = sorted[i]!;
      const b0 = sorted[j]!;
      const sA = getSingleForMorningFallback(a0, singleById, byRes, morningSlotIdSet, fallbackSlotId);
      const sB = getSingleForMorningFallback(b0, singleById, byRes, morningSlotIdSet, fallbackSlotId);
      if (!sA || !sB) continue;

      if (!relaxPrefs && !morningMatchSlotRespectsPrefs(slotId, a0, b0, sA, sB, byRes, slotById)) {
        continue;
      }

      const xa = a0.localeCompare(b0) <= 0 ? a0 : b0;
      const xb = a0.localeCompare(b0) <= 0 ? b0 : a0;
      if (requireSpreadOk && !playCountSpreadOkAfterAddingOne(baseCounts, activeIds, xa, xb)) continue;

      const ma = playerMorningMatchCount(rows, a0);
      const mb = playerMorningMatchCount(rows, b0);
      let score = ma * 500 + mb * 500;
      if (areAdjacent(morningEdge, a0, b0)) score += 120;
      if (strengthOf(byRes.get(a0)) !== strengthOf(byRes.get(b0))) score += 40;
      score += playerMatchCount(rows, a0) + playerMatchCount(rows, b0);

      const tie = `${xa}\0${xb}`;
      if (
        best === null ||
        score < best.score ||
        (score === best.score && tie.localeCompare(best.tie) < 0)
      ) {
        best = { a: xa, b: xb, score, tie };
      }
    }
  }
  if (!best) return null;
  return { a: best.a, b: best.b };
}

function applyMorningMandatoryEmptySlotFill(params: {
  rows: RpcAssignmentRow[];
  morningEdge: Map<string, Set<string>>;
  morningSlots: SlotRow[];
  fixedSlotIds: Set<string>;
  singleById: Map<string, Single>;
  byRes: Map<string, ReservationRow>;
  slotById: Map<string, SlotRow>;
  morningSlotIdSet: Set<string>;
  fallbackSlotId: string;
  activeIds: string[];
  notes: string[];
}): void {
  const {
    rows,
    morningEdge,
    morningSlots,
    fixedSlotIds,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
    activeIds,
    notes,
  } = params;

  const listEmptySlotIds = (): string[] =>
    morningSlots
      .filter((s) => s.id && !fixedSlotIds.has(s.id) && !morningSlotHasAssignment(rows, s.id))
      .sort((s1, s2) => slotOrderKey(s1).localeCompare(slotOrderKey(s2)))
      .map((s) => s.id);

  const maxSteps = Math.max(16, morningSlots.length * 3);
  let steps = 0;

  while (listEmptySlotIds().length > 0 && steps < maxSteps) {
    steps += 1;
    const slotId = listEmptySlotIds()[0];
    if (!slotId) break;

    const pair =
      pickMorningMandatoryPairForEmptySlot({
        slotId,
        relaxPrefs: false,
        requireSpreadOk: true,
        rows,
        morningEdge,
        activeIds,
        singleById,
        byRes,
        slotById,
        morningSlotIdSet,
        fallbackSlotId,
      }) ??
      pickMorningMandatoryPairForEmptySlot({
        slotId,
        relaxPrefs: true,
        requireSpreadOk: true,
        rows,
        morningEdge,
        activeIds,
        singleById,
        byRes,
        slotById,
        morningSlotIdSet,
        fallbackSlotId,
      }) ??
      pickMorningMandatoryPairForEmptySlot({
        slotId,
        relaxPrefs: false,
        requireSpreadOk: false,
        rows,
        morningEdge,
        activeIds,
        singleById,
        byRes,
        slotById,
        morningSlotIdSet,
        fallbackSlotId,
      }) ??
      pickMorningMandatoryPairForEmptySlot({
        slotId,
        relaxPrefs: true,
        requireSpreadOk: false,
        rows,
        morningEdge,
        activeIds,
        singleById,
        byRes,
        slotById,
        morningSlotIdSet,
        fallbackSlotId,
      });

    if (!pair) {
      notes.push(
        `午前必須埋め: 枠 ${slotId} にペアを割り当てられません（active が2未満など）。空枠が残ります。`
      );
      break;
    }

    const w: string[] = ["mandatory_morning_slot_fill"];
    const spreadBefore = buildPlayCountsFromRows(rows, activeIds);
    if (!playCountSpreadOkAfterAddingOne(spreadBefore, activeIds, pair.a, pair.b)) {
      w.push("match_count_spread_violation");
    }
    if (
      playerMorningMatchCount(rows, pair.a) >= 1 ||
      playerMorningMatchCount(rows, pair.b) >= 1
    ) {
      w.push("repeat_morning_play");
    }
    if (strengthOf(byRes.get(pair.a)) !== strengthOf(byRes.get(pair.b))) w.push("cross_category_match");
    if (areAdjacent(morningEdge, pair.a, pair.b)) w.push("duplicate_opponent");

    const sA = getSingleForMorningFallback(pair.a, singleById, byRes, morningSlotIdSet, fallbackSlotId);
    const sB = getSingleForMorningFallback(pair.b, singleById, byRes, morningSlotIdSet, fallbackSlotId);
    if (
      sA &&
      sB &&
      !morningMatchSlotRespectsPrefs(slotId, pair.a, pair.b, sA, sB, byRes, slotById)
    ) {
      w.push("morning_fallback_relaxed_prefs");
    }

    rows.push({
      event_day_slot_id: slotId,
      match_phase: "morning",
      assignment_type: "morning_fill",
      reservation_a_id: pair.a,
      reservation_b_id: pair.b,
      referee_reservation_id: null,
      warning_json: [...new Set(w)],
    });
    addUndirectedEdge(morningEdge, pair.a, pair.b);
    notes.push(`午前必須埋め: 枠 ${slotId} に試合を追加（空枠解消優先）`);
  }
}

/** 候補辺を足した後、全日の max(累計)−min(累計) が 2 未満か（偏りが 2 以上に広がる候補を原則捨てる） */
function afternoonSpreadOkAfterEdge(
  totalDayPlay: Map<string, number>,
  activeIds: string[],
  a: string,
  b: string
): boolean {
  return afternoonGlobalBalanceAfterEdge(totalDayPlay, activeIds, a, b).spread < 2;
}

/** 1=異カテゴリ、0=同カテゴリ */
function diffCategoryPenalty(ra: string, rb: string, byRes: Map<string, ReservationRow>): 0 | 1 {
  return strengthOf(byRes.get(ra)) === strengthOf(byRes.get(rb)) ? 0 : 1;
}

/** 候補辺 (a,b) を足した後の全日 active の試合数分布（ペア内差ではなく全体） */
function afternoonGlobalBalanceAfterEdge(
  totalDayPlay: Map<string, number>,
  activeIds: string[],
  a: string,
  b: string
): { spread: number; countAtMin: number; globalMax: number } {
  if (activeIds.length === 0) return { spread: 0, countAtMin: 0, globalMax: 0 };
  const counts = activeIds.map((id) => {
    let g = totalDayPlay.get(id) ?? 0;
    if (id === a || id === b) g += 1;
    return g;
  });
  const mi = Math.min(...counts);
  const ma = Math.max(...counts);
  const countAtMin = counts.filter((g) => g === mi).length;
  return { spread: ma - mi, countAtMin, globalMax: ma };
}

/** 午後ペア（辺）の辞書式キー（spread<2 フィルタ後の辞書式比較用） */
type AfternoonPairPickKey = {
  diffCatPenalty: 0 | 1;
  priorDayMatches: number;
  /** 午後第2段階: 既に午後1試合ある端の全日累計の和（小さいほど「総試合少ない人に2試合目」を寄せる） */
  secondAfternoonPlaySum: number;
  spread: number;
  countAtMin: number;
  gapSum: number;
  consec: number;
  globalMax: number;
  pairMaxAfter: number;
  edge: string;
};

function buildAfternoonPairPickKey(
  activeIds: string[],
  ra: string,
  rb: string,
  slotId: string,
  rows: RpcAssignmentRow[],
  planned: AfternoonPlan[],
  globalIndex: Map<string, number>,
  byRes: Map<string, ReservationRow>,
  dayOpponentCount: Map<string, Map<string, number>>,
  totalDayPlay: Map<string, number>,
  afternoonCount: Map<string, number>
): AfternoonPairPickKey {
  const pa = totalDayPlay.get(ra) ?? 0;
  const pb = totalDayPlay.get(rb) ?? 0;
  const ca = afternoonCount.get(ra) ?? 0;
  const cb = afternoonCount.get(rb) ?? 0;
  const secondAfternoonPlaySum = (ca >= 1 ? pa : 0) + (cb >= 1 ? pb : 0);
  let consec = 0;
  if (isHardConsecutivePlay(ra, slotId, rows, planned, globalIndex)) consec += 1;
  if (isHardConsecutivePlay(rb, slotId, rows, planned, globalIndex)) consec += 1;
  const gapSum =
    slotGapSoftPenalty(playGapForSlot(ra, slotId, rows, planned, globalIndex)) +
    slotGapSoftPenalty(playGapForSlot(rb, slotId, rows, planned, globalIndex));
  const edge = ra.localeCompare(rb) < 0 ? `${ra}:${rb}` : `${rb}:${ra}`;
  const bal = afternoonGlobalBalanceAfterEdge(totalDayPlay, activeIds, ra, rb);
  return {
    diffCatPenalty: diffCategoryPenalty(ra, rb, byRes),
    priorDayMatches: sameDayOpponentCount(dayOpponentCount, ra, rb),
    secondAfternoonPlaySum,
    spread: bal.spread,
    countAtMin: bal.countAtMin,
    gapSum,
    consec,
    globalMax: bal.globalMax,
    pairMaxAfter: Math.max(pa + 1, pb + 1),
    edge,
  };
}

function isAfternoonPairPickKeyBetter(
  a: AfternoonPairPickKey,
  b: AfternoonPairPickKey,
  afternoonPhase: 1 | 2
): boolean {
  // 追加後 spread<2 は呼び出し側の pickEdges で優先済み。ここでは 同カ → 未対戦 → gap/連続 → 残りタイブレーク
  if (a.diffCatPenalty !== b.diffCatPenalty) return a.diffCatPenalty < b.diffCatPenalty;
  if (a.priorDayMatches !== b.priorDayMatches) return a.priorDayMatches < b.priorDayMatches;
  if (afternoonPhase === 2 && a.secondAfternoonPlaySum !== b.secondAfternoonPlaySum) {
    return a.secondAfternoonPlaySum < b.secondAfternoonPlaySum;
  }
  if (a.gapSum !== b.gapSum) return a.gapSum < b.gapSum;
  if (a.consec !== b.consec) return a.consec < b.consec;
  if (a.spread !== b.spread) return a.spread < b.spread;
  if (a.countAtMin !== b.countAtMin) return a.countAtMin < b.countAtMin;
  if (a.globalMax !== b.globalMax) return a.globalMax < b.globalMax;
  if (a.pairMaxAfter !== b.pairMaxAfter) return a.pairMaxAfter < b.pairMaxAfter;
  return a.edge.localeCompare(b.edge) < 0;
}

/**
 * 午後の空枠 slotId に載せるペア。
 * **activeIds 上の全無向辺**のうち、`eligible(id)` を両端が満たす辺だけ候補。
 * 第1段階は `afternoonCount < 1`（全員にまず午後1試合）、第2段階は空枠が残るときのみ `afternoonCount < 2` を許可。
 * 「ペア内累計差 maxDiff」のみ段階緩和。連続枠はキー（consec）で劣後。
 * 各段で **追加後の全日 max(累計)−min(累計)≤1** の辺のみ候補（違反辺は採用しない）。
 * **午前辺と同一のペア、または同日対戦が既に1回以上**の辺は、当段でそれ以外の辺が1本でもあれば比較から除外（なければフォールバックで許容）。
 * **同カテゴリ完結ハード**: active の strong/potential がどちらも偶数人数で、かつ残り枠を同カ・重複規則・各 active の午後上限（`afternoonMaxPerPlayer`）のもとで埋められると判定できるときは、候補から異カテゴリ辺を除く（除いた結果が空ならフォールバックで異カも可）。
 */
function pickBestAfternoonPairForSlot(params: {
  activeIds: string[];
  /** この枠に出場させたい人（第1段階: 午後0試合のみ / 第2段階: 午後2試合未満） */
  eligible: (id: string) => boolean;
  /** 各予約の午後試合数（同カ完結 DFS 用） */
  afternoonCount: Map<string, number>;
  /** 1: まず全員午後1試合 / 2: 空枠解消のため午後2試合目を最小限許可 */
  afternoonPhase: 1 | 2;
  /** 同カ完結 DFS で使う「1人あたり午後に載せられる最大試合数」（第1段階1・第2段階2） */
  afternoonMaxPerPlayer: number;
  /** この枠を含む、まだ割り当てていない午後枠の本数 */
  remainingAfternoonSlots: number;
  morningEdge: Map<string, Set<string>>;
  slotId: string;
  rows: RpcAssignmentRow[];
  planned: AfternoonPlan[];
  globalIndex: Map<string, number>;
  byRes: Map<string, ReservationRow>;
  dayOpponentCount: Map<string, Map<string, number>>;
  totalDayPlay: Map<string, number>;
}): { a: string; b: string } | null {
  const {
    activeIds,
    eligible,
    afternoonCount,
    afternoonPhase,
    afternoonMaxPerPlayer,
    remainingAfternoonSlots,
    morningEdge,
    slotId,
    rows,
    planned,
    globalIndex,
    byRes,
    dayOpponentCount,
    totalDayPlay,
  } = params;

  let eligibleCount = 0;
  for (const id of activeIds) {
    if (eligible(id)) eligibleCount += 1;
  }
  if (eligibleCount < 2) return null;

  const hardIntraCategoryOnly =
    activeEvenCountsPerStrengthCategory(activeIds, byRes) &&
    canFillRemainingAfternoonWithIntraCategoryOnly(
      activeIds,
      byRes,
      afternoonCount,
      dayOpponentCount,
      morningEdge,
      remainingAfternoonSlots,
      afternoonMaxPerPlayer
    );

  const sortedIds = [...activeIds].sort((a, b) => a.localeCompare(b));
  const maxDiffStages = [1, 2, 3, Infinity] as const;

  for (const maxD of maxDiffStages) {
    type Edge = { ra: string; rb: string; pa: number; pb: number };
    const edges: Edge[] = [];
    for (let i = 0; i < sortedIds.length; i++) {
      const ra = sortedIds[i]!;
      if (!eligible(ra)) continue;
      for (let j = i + 1; j < sortedIds.length; j++) {
        const rb = sortedIds[j]!;
        if (!eligible(rb)) continue;
        const pa = totalDayPlay.get(ra) ?? 0;
        const pb = totalDayPlay.get(rb) ?? 0;
        const d = Math.abs(pa - pb);
        if (maxD !== Infinity && d > maxD) continue;
        edges.push({ ra, rb, pa, pb });
      }
    }
    if (edges.length === 0) continue;

    const balancedEdges = edges.filter((e) => Math.abs(e.pa - e.pb) < 2);
    const useEdges = balancedEdges.length > 0 ? balancedEdges : edges;

    // 全日の試合数 max−min が 1 を超えない辺のみ（違反辺は採用しない。候補が無ければ当段はスキップ）
    const spreadTight = useEdges.filter((e) => afternoonSpreadOkAfterEdge(totalDayPlay, activeIds, e.ra, e.rb));
    if (spreadTight.length === 0) continue;

    const withoutDup = spreadTight.filter(
      (e) => !afternoonPairIsDuplicate(e.ra, e.rb, morningEdge, dayOpponentCount)
    );
    let consider = withoutDup.length > 0 ? withoutDup : spreadTight;

    if (hardIntraCategoryOnly) {
      const intra = consider.filter((e) => diffCategoryPenalty(e.ra, e.rb, byRes) === 0);
      if (intra.length > 0) consider = intra;
    }

    let best: { a: string; b: string; key: AfternoonPairPickKey } | null = null;
    for (const e of consider) {
      const key = buildAfternoonPairPickKey(
        activeIds,
        e.ra,
        e.rb,
        slotId,
        rows,
        planned,
        globalIndex,
        byRes,
        dayOpponentCount,
        totalDayPlay,
        afternoonCount
      );
      if (best === null || isAfternoonPairPickKeyBetter(key, best.key, afternoonPhase)) {
        best = { a: e.ra, b: e.rb, key };
      }
    }
    if (best !== null) {
      const x = best.a.localeCompare(best.b) < 0 ? best.a : best.b;
      const y = best.a.localeCompare(best.b) < 0 ? best.b : best.a;
      return { a: x, b: y };
    }
  }
  return null;
}

type DayMatchSides = { a: string; b: string };

/**
 * 全日（午前→午後の時間順）の試合インデックス gi に対する審判の「寄せ先」。
 * - gi === 0 かつ2試合以上: **2試合目の出場2人のみ**を第一候補（1試合目の審判）
 * - それ以外で次の試合がある: **次の試合に出ない** active を第一候補
 * - 最終試合: 当事者以外の active を第一候補（次がないので全員「次に出ない」）
 */
function buildRefereePreferenceForDayMatch(
  gi: number,
  dayMatches: DayMatchSides[],
  allActiveIds: string[]
): { preferredIds: Set<string>; fromSecondMatchOnly: boolean } {
  const n = dayMatches.length;
  if (n === 0) return { preferredIds: new Set(), fromSecondMatchOnly: false };

  const cur = dayMatches[gi]!;
  if (gi === 0 && n >= 2) {
    const m2 = dayMatches[1]!;
    return {
      preferredIds: new Set([m2.a, m2.b]),
      fromSecondMatchOnly: true,
    };
  }

  if (gi < n - 1) {
    const nx = dayMatches[gi + 1]!;
    const idle = allActiveIds.filter(
      (id) => id !== cur.a && id !== cur.b && id !== nx.a && id !== nx.b
    );
    return { preferredIds: new Set(idle), fromSecondMatchOnly: false };
  }

  const idle = allActiveIds.filter((id) => id !== cur.a && id !== cur.b);
  return { preferredIds: new Set(idle), fromSecondMatchOnly: false };
}

/**
 * 午前のみの審判優先（全日 `dayMatches` とは独立。午後の審判ロジックは変更しない）。
 * ①1枠目: 当枠に出ない かつ 次の午前枠に出る予約を優先
 * ②2枠目: 当枠に出ない かつ 直前の午前枠に出ていた予約を優先
 * ③午前インデックス2以降（3枠目〜）: 優先集合なし（`pickRefereeForDayMatch` の通常ティアのみ）
 * 優先候補が当枠の出場者と重なる場合はそのIDを除く。結果が空ならフォールバック（全候補同ティア）。
 */
function buildMorningSlotRefereePreference(
  morningIndex: number,
  morningRows: RpcAssignmentRow[]
): { preferredIds: Set<string>; fromSecondMatchOnly: boolean } {
  const row = morningRows[morningIndex]!;
  const curA = row.reservation_a_id;
  const curB = row.reservation_b_id;
  const notInCurrent = (id: string) => id !== curA && id !== curB;

  if (morningIndex === 0 && morningRows.length >= 2) {
    const nx = morningRows[1]!;
    const ids = [nx.reservation_a_id, nx.reservation_b_id].filter(notInCurrent);
    return { preferredIds: new Set(ids), fromSecondMatchOnly: false };
  }
  if (morningIndex === 1) {
    const pr = morningRows[0]!;
    const ids = [pr.reservation_a_id, pr.reservation_b_id].filter(notInCurrent);
    return { preferredIds: new Set(ids), fromSecondMatchOnly: false };
  }
  return { preferredIds: new Set(), fromSecondMatchOnly: false };
}

/**
 * 審判を1名選ぶ。
 * - 1試合目: 2試合目の出場2人を強く優先（審判回数が大きく偏れば他候補が勝つ）
 * - ほか: 「次の試合に出ない」候補を優先。優先集合が空なら審判回数・出場のみで決める
 * - 直前の試合の審判と同一の連続割当を避ける（強いペナルティ。避けられないときは回数で勝つ）
 */
function pickRefereeForDayMatch(params: {
  a: string;
  b: string;
  preferredIds: Set<string>;
  fromSecondMatchOnly: boolean;
  /** 時間順で直前に付けた審判（同一なら連続回避ペナルティ） */
  previousRefereeId: string | null;
  allActiveIds: string[];
  rows: RpcAssignmentRow[];
}): { refereeId: string | null; warnings: string[] } {
  const { a, b, preferredIds, fromSecondMatchOnly, previousRefereeId, allActiveIds, rows } = params;
  const warnings: string[] = [];
  const candidates = allActiveIds.filter((id) => id !== a && id !== b);
  if (candidates.length === 0) {
    warnings.push("referee_unassigned");
    return { refereeId: null, warnings };
  }

  const scored = candidates.map((id) => {
    const inPref = preferredIds.has(id);
    let tier = 0;
    if (fromSecondMatchOnly) {
      tier = inPref ? 0 : REFEREE_NOT_FROM_SECOND_MATCH_PENALTY;
    } else if (preferredIds.size > 0) {
      tier = inPref ? 0 : REFEREE_NOT_IDLE_BEFORE_NEXT_PENALTY;
    }
    const refC = refereeCount(rows, id);
    const playC = playerMatchCount(rows, id);
    const consec =
      previousRefereeId != null && id === previousRefereeId ? REFEREE_CONSECUTIVE_SAME_PENALTY : 0;
    const score = tier + refC * 10 + playC * 2 + consec;
    return { id, score };
  });
  scored.sort((x, y) => {
    if (x.score !== y.score) return x.score - y.score;
    return x.id.localeCompare(y.id);
  });
  const best = scored[0]!;
  return { refereeId: best.id, warnings };
}

/**
 * 編成結果の rows とメタ情報を返す（DB 未書き込み）。
 * 入力は service_role で取得済みの行。event_day は locked であること。
 */
function computeBuildMatchingAssignments(params: {
  slots: SlotRow[];
  reservationsActive: ReservationRow[];
  currentAssignments: CurrentAssignmentRow[];
}): BuildMatchingResult {
  const meta: BuildMatchingMeta = {
    unfilledMorningReservationIds: [],
    unfilledAfternoonReservationIds: [],
    notes: [],
  };

  const { slots, reservationsActive, currentAssignments } = params;
  const byRes = new Map(reservationsActive.map((r) => [r.id, r]));
  const nActive = reservationsActive.length;

  // --- 枠一覧（非アクティブ除外・枠コード順） ---
  const morningSlots = slots
    .filter((s) => s.phase === "morning" && s.is_active !== false)
    .sort((a, b) => slotOrderKey(a).localeCompare(slotOrderKey(b)));
  const slotById = new Map<string, SlotRow>(
    slots.filter((s) => s.is_active !== false).map((s) => [s.id, s])
  );
  const afternoonSlots = slots
    .filter((s) => s.phase === "afternoon" && s.is_active !== false)
    .sort((a, b) => slotOrderKey(a).localeCompare(slotOrderKey(b)));
  const globalSlotIndex = buildGlobalSlotIndex(morningSlots, afternoonSlots);

  const rows: RpcAssignmentRow[] = [];

  // --- 午前①: 確定済み morning_fixed をそのまま引き継ぎ（active でない予約参照は除外し RPC エラーを防ぐ） ---
  const activeIdSet = new Set(reservationsActive.map((r) => r.id));
  const rawMorningFixed = currentAssignments.filter(
    (a) => a.assignment_type === "morning_fixed" && a.match_phase === "morning"
  );
  const fixedFromCurrent = filterMorningFixedEligibleForActive(rawMorningFixed, activeIdSet);
  if (rawMorningFixed.length > fixedFromCurrent.length) {
    const n = rawMorningFixed.length - fixedFromCurrent.length;
    meta.notes.push(
      `morning_fixed のうち active 予約にない参加者を含む ${n} 件を除外しました（キャンセル済み等）。該当枠は午前補完の対象になります。`
    );
  }
  for (const f of fixedFromCurrent) {
    const w = Array.isArray(f.warning_json)
      ? (f.warning_json as string[])
      : typeof f.warning_json === "object" && f.warning_json !== null
        ? []
        : [];
    rows.push({
      event_day_slot_id: f.event_day_slot_id,
      match_phase: "morning",
      assignment_type: "morning_fixed",
      reservation_a_id: f.reservation_a_id,
      reservation_b_id: f.reservation_b_id,
      referee_reservation_id: f.referee_reservation_id,
      warning_json: w,
    });
  }

  if (nActive < 2) {
    meta.notes.push(`参加が2チーム未満（${nActive}件）のため午前固定のみ反映し編成を打ち切ります`);
    const ids = reservationsActive.map((r) => r.id);
    return {
      assignments: rows,
      meta: {
        unfilledMorningReservationIds: ids,
        unfilledAfternoonReservationIds: ids,
        notes: meta.notes,
      },
    };
  }

  const activeIds = reservationsActive.map((r) => r.id).sort((a, b) => a.localeCompare(b));

  let morningEdge = morningEdgesFromRows(rows);
  const fixedSlotIds = new Set(fixedFromCurrent.map((f) => f.event_day_slot_id));

  // --- 午前②: 各午前枠の希望 active を singles 候補にする ---
  // - 非固定枠: 1件以上なら全員（同枠2件以上も従来は漏れていた）
  // - morning_fixed と同一枠を希望したが a/b に含まれない予約は、枠全体を skip すると singles に載らず午前から漏れるため、
  //   固定枠でも「固定の当事者以外」を singles に載せる
  // - まだ載っていない active（午前枠 ID が null / 無効など）は、非固定の先頭枠を所在のフォールバックにして載せる
  const morningSlotIdSet = new Set(morningSlots.map((s) => s.id).filter(Boolean));
  const anchorNonFixedSlotId =
    morningSlots.find((s) => s.id && !fixedSlotIds.has(s.id))?.id ?? null;
  const fixedPlayers = new Set<string>();
  for (const f of fixedFromCurrent) {
    fixedPlayers.add(f.reservation_a_id);
    fixedPlayers.add(f.reservation_b_id);
  }

  const singles: Single[] = [];
  for (const slot of morningSlots) {
    if (!slot.id) continue;
    const inSlot = reservationsActive
      .filter((r) => r.selected_morning_slot_id === slot.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (fixedSlotIds.has(slot.id)) {
      const fr = fixedFromCurrent.find((f) => f.event_day_slot_id === slot.id);
      if (fr) {
        const fa = fr.reservation_a_id;
        const fb = fr.reservation_b_id;
        for (const r of inSlot) {
          if (r.id === fa || r.id === fb) continue;
          singles.push({ slotId: slot.id, reservationId: r.id });
        }
      } else if (inSlot.length === 1) {
        singles.push({ slotId: slot.id, reservationId: inSlot[0]!.id });
      } else if (inSlot.length >= 2) {
        for (const r of inSlot) {
          singles.push({ slotId: slot.id, reservationId: r.id });
        }
      }
      continue;
    }
    if (inSlot.length === 1) {
      singles.push({ slotId: slot.id, reservationId: inSlot[0]!.id });
    } else if (inSlot.length >= 2) {
      for (const r of inSlot) {
        singles.push({ slotId: slot.id, reservationId: r.id });
      }
    }
  }

  const inSinglesIds = new Set(singles.map((s) => s.reservationId));
  for (const r of reservationsActive) {
    if (inSinglesIds.has(r.id)) continue;
    if (fixedPlayers.has(r.id)) continue;
    const sid = r.selected_morning_slot_id;
    if (sid && morningSlotIdSet.has(sid)) {
      singles.push({ slotId: sid, reservationId: r.id });
      inSinglesIds.add(r.id);
    } else if (anchorNonFixedSlotId) {
      singles.push({ slotId: anchorNonFixedSlotId, reservationId: r.id });
      inSinglesIds.add(r.id);
    }
  }

  // 希望者がいる午前枠（有効な午前枠 ID を希望に持つ active が1人以上）
  const hopeMorningSlotIds = new Set<string>();
  for (const r of reservationsActive) {
    const sid = r.selected_morning_slot_id;
    if (sid && morningSlotIdSet.has(sid)) hopeMorningSlotIds.add(sid);
  }

  const dedupSingles = dedupeSinglesByReservationId(singles);
  const singleById = new Map(dedupSingles.map((s) => [s.reservationId, s]));
  const fallbackSlotId =
    anchorNonFixedSlotId ?? morningSlots.find((s) => s.id && !fixedSlotIds.has(s.id))?.id ?? "";
  for (const r of reservationsActive) {
    if (fixedPlayers.has(r.id)) continue;
    if (!singleById.has(r.id)) {
      singleById.set(r.id, {
        reservationId: r.id,
        slotId: r.selected_morning_slot_id && morningSlotIdSet.has(r.selected_morning_slot_id)
          ? r.selected_morning_slot_id
          : fallbackSlotId,
      });
    }
  }

  const poolIds = reservationsActive
    .map((r) => r.id)
    .filter((id) => !fixedPlayers.has(id))
    .sort((a, b) => a.localeCompare(b));

  const fillPlan =
    poolIds.length > MORNING_FILL_DFS_POOL_MAX
      ? greedyMorningFillPlan({
          poolIds,
          activeIds,
          singleById,
          morningEdgeBase: morningEdge,
          fixedRows: rows,
          byRes,
          slotById,
          fixedSlotIds,
          morningSlotsOrdered: morningSlots,
        })
      : searchOptimalMorningFillPlan({
          poolIds,
          activeIds,
          singleById,
          morningEdgeBase: morningEdge,
          fixedRows: rows,
          byRes,
          slotById,
          fixedSlotIds,
          morningSlotsOrdered: morningSlots,
          hopeMorningSlotIds,
          fixedFromCurrent,
        });

  if (fillPlan.length > 0) {
    meta.notes.push(
      poolIds.length > MORNING_FILL_DFS_POOL_MAX
        ? "午前 morning_fill: 固定外を貪欲で選定（プール規模・全日試合数バランス優先）"
        : "午前 morning_fill: 固定外を全探索で選定（試合数・希望枠カバー優先）"
    );
  }

  for (const f of fillPlan) {
    const warnings: string[] = [];
    if (strengthOf(byRes.get(f.a)) !== strengthOf(byRes.get(f.b))) {
      warnings.push("cross_category_match");
    }
    rows.push({
      event_day_slot_id: f.slotId,
      match_phase: "morning",
      assignment_type: "morning_fill",
      reservation_a_id: f.a,
      reservation_b_id: f.b,
      referee_reservation_id: null,
      warning_json: warnings,
    });
    addUndirectedEdge(morningEdge, f.a, f.b);
  }

  applyMorningSlotFillFallback({
    rows,
    morningEdge,
    morningSlots,
    fixedSlotIds,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
    poolIds,
    activeIds,
    notes: meta.notes,
  });

  applyMorningMandatoryEmptySlotFill({
    rows,
    morningEdge,
    morningSlots,
    fixedSlotIds,
    singleById,
    byRes,
    slotById,
    morningSlotIdSet,
    fallbackSlotId,
    activeIds,
    notes: meta.notes,
  });

  // プール内で午前に1試合も付かない予約（フォールバック後も残る場合）
  for (const id of poolIds) {
    if (playerMorningMatchCount(rows, id) === 0) {
      meta.unfilledMorningReservationIds.push(id);
      const sg = singleById.get(id);
      meta.notes.push(
        `午前未ペア: 予約 ${id}${sg ? `（枠 ${sg.slotId}）` : ""}`
      );
    }
  }

  // 午後計画に使う「午前までの対戦回数」（この後の planned で増やす）
  morningEdge = morningEdgesFromRows(rows);
  const dayOpponentCount = new Map<string, Map<string, number>>();
  for (const row of rows) {
    bumpOpponentCount(dayOpponentCount, row.reservation_a_id, row.reservation_b_id);
  }

  // 各人の午後試合数（単一枠ループの計画で更新）
  const afternoonCount = new Map<string, number>();
  for (const id of activeIds) afternoonCount.set(id, 0);

  const planned: AfternoonPlan[] = [];
  const usedAfternoonSlotIds = new Set<string>();
  /** 午前終了時点の出場＋午後で確定した計画分（偏り平準化用） */
  const totalDayPlay = new Map<string, number>();
  for (const id of activeIds) {
    totalDayPlay.set(id, playerMatchCount(rows, id));
  }

  // --- 午後: 第1段階で「午後0試合」の者だけ埋め、空枠が残れば第2段階で `afternoonCount < 2` を最小限許可 ---
  const afternoonSlotCount = afternoonSlots.length;
  const extraAfternoonAppearancesNeeded = Math.max(0, afternoonSlotCount * 2 - activeIds.length);

  const countAfternoonEligibleLt = (n: number) => activeIds.filter((id) => afternoonCount.get(id)! < n).length;

  for (const slot of afternoonSlots) {
    if (usedAfternoonSlotIds.has(slot.id)) continue;
    if (countAfternoonEligibleLt(1) < 2) break;

    const remainingSlots = afternoonSlots.filter((s) => !usedAfternoonSlotIds.has(s.id)).length;

    const pair = pickBestAfternoonPairForSlot({
      activeIds,
      eligible: (id) => afternoonCount.get(id)! < 1,
      afternoonPhase: 1,
      afternoonMaxPerPlayer: 1,
      afternoonCount,
      remainingAfternoonSlots: remainingSlots,
      morningEdge,
      slotId: slot.id,
      rows,
      planned,
      globalIndex: globalSlotIndex,
      byRes,
      dayOpponentCount,
      totalDayPlay,
    });
    if (!pair) break;

    const { a: r1, b: r2 } = pair;
    planned.push({ slotId: slot.id, a: r1, b: r2 });
    usedAfternoonSlotIds.add(slot.id);
    bumpOpponentCount(dayOpponentCount, r1, r2);
    afternoonCount.set(r1, afternoonCount.get(r1)! + 1);
    afternoonCount.set(r2, afternoonCount.get(r2)! + 1);
    totalDayPlay.set(r1, (totalDayPlay.get(r1) ?? 0) + 1);
    totalDayPlay.set(r2, (totalDayPlay.get(r2) ?? 0) + 1);
  }

  const hasUnusedAfternoonSlot = afternoonSlots.some((s) => !usedAfternoonSlotIds.has(s.id));
  if (hasUnusedAfternoonSlot) {
    meta.notes.push(
      `午後第2段階: 空枠解消のため午後2試合目を許可（理論上の追加出場必要数=${extraAfternoonAppearancesNeeded}、総試合が少ない予約を優先）`
    );
    for (const slot of afternoonSlots) {
      if (usedAfternoonSlotIds.has(slot.id)) continue;
      if (countAfternoonEligibleLt(2) < 2) break;

      const remainingSlots = afternoonSlots.filter((s) => !usedAfternoonSlotIds.has(s.id)).length;

      const pair = pickBestAfternoonPairForSlot({
        activeIds,
        eligible: (id) => afternoonCount.get(id)! < 2,
        afternoonPhase: 2,
        afternoonMaxPerPlayer: 2,
        afternoonCount,
        remainingAfternoonSlots: remainingSlots,
        morningEdge,
        slotId: slot.id,
        rows,
        planned,
        globalIndex: globalSlotIndex,
        byRes,
        dayOpponentCount,
        totalDayPlay,
      });
      if (!pair) continue;

      const { a: r1, b: r2 } = pair;
      planned.push({ slotId: slot.id, a: r1, b: r2, phase2: true });
      usedAfternoonSlotIds.add(slot.id);
      bumpOpponentCount(dayOpponentCount, r1, r2);
      afternoonCount.set(r1, afternoonCount.get(r1)! + 1);
      afternoonCount.set(r2, afternoonCount.get(r2)! + 1);
      totalDayPlay.set(r1, (totalDayPlay.get(r1) ?? 0) + 1);
      totalDayPlay.set(r2, (totalDayPlay.get(r2) ?? 0) + 1);
    }
  }

  // 出力・審判は枠の時間順（午後 slot の並び）に合わせる
  const slotIndexById = new Map(afternoonSlots.map((s, i) => [s.id, i]));
  const plannedSorted = [...planned].sort(
    (p, q) =>
      (slotIndexById.get(p.slotId) ?? 99) - (slotIndexById.get(q.slotId) ?? 99)
  );

  // 午前の試合行（時間順）— 審判は午前＋午後を通した「全日の試合列」でインデックスを決める
  const morningRowsInSlotOrder: RpcAssignmentRow[] = [];
  for (const s of morningSlots) {
    const hit = rows.find((r) => r.event_day_slot_id === s.id && r.match_phase === "morning");
    if (hit) morningRowsInSlotOrder.push(hit);
  }

  const dayMatches: DayMatchSides[] = [
    ...morningRowsInSlotOrder.map((r) => ({
      a: r.reservation_a_id,
      b: r.reservation_b_id,
    })),
    ...plannedSorted.map((p) => ({ a: p.a, b: p.b })),
  ];

  // 午前の試合行に審判を付与（morning_fixed で DB から審判が付いている行は上書きしない）
  let lastRefereeId: string | null = null;
  for (let mi = 0; mi < morningRowsInSlotOrder.length; mi++) {
    const row = morningRowsInSlotOrder[mi]!;
    if (row.referee_reservation_id) {
      lastRefereeId = row.referee_reservation_id;
      continue;
    }
    const pref = buildMorningSlotRefereePreference(mi, morningRowsInSlotOrder);
    const { refereeId, warnings: rw } = pickRefereeForDayMatch({
      a: row.reservation_a_id,
      b: row.reservation_b_id,
      preferredIds: pref.preferredIds,
      fromSecondMatchOnly: pref.fromSecondMatchOnly,
      previousRefereeId: lastRefereeId,
      allActiveIds: activeIds,
      rows,
    });
    row.referee_reservation_id = refereeId;
    row.warning_json = [...new Set([...row.warning_json, ...rw])];
    if (refereeId != null) lastRefereeId = refereeId;
  }

  // 警告用の同日対戦回数は「午前のみ」から再初期化し、このループ内で午後行を足しながら積む
  // （計画段階の bump と二重にしないため。duplicate_opponent は「午前後合算で2回目以降」意図）
  dayOpponentCount.clear();
  for (const row of rows) {
    if (row.match_phase === "morning") {
      bumpOpponentCount(dayOpponentCount, row.reservation_a_id, row.reservation_b_id);
    }
  }

  // --- 午後行の確定出力（この時点で rows に morning まで入っている） ---
  const morningMatchCount = morningRowsInSlotOrder.length;

  for (let pi = 0; pi < plannedSorted.length; pi++) {
    const p = plannedSorted[pi];
    const gi = morningMatchCount + pi;
    const pref = buildRefereePreferenceForDayMatch(gi, dayMatches, activeIds);

    const w: string[] = [];
    if (p.phase2) w.push("afternoon_second_round_fill");
    if (strengthOf(byRes.get(p.a)) !== strengthOf(byRes.get(p.b))) w.push("cross_category_match");
    // 午前の同一ペアと再度当たる場合
    if (areAdjacent(morningEdge, p.a, p.b)) w.push("duplicate_opponent");
    // この午後行を足す前に、すでに同日で1回以上当たっている（午後第2巡など）
    if (sameDayOpponentCount(dayOpponentCount, p.a, p.b) >= 1) {
      w.push("duplicate_opponent");
    }

    const { refereeId, warnings: rw } = pickRefereeForDayMatch({
      a: p.a,
      b: p.b,
      preferredIds: pref.preferredIds,
      fromSecondMatchOnly: pref.fromSecondMatchOnly,
      previousRefereeId: lastRefereeId,
      allActiveIds: activeIds,
      rows,
    });
    w.push(...rw);

    rows.push({
      event_day_slot_id: p.slotId,
      match_phase: "afternoon",
      assignment_type: "afternoon_auto",
      reservation_a_id: p.a,
      reservation_b_id: p.b,
      referee_reservation_id: refereeId,
      warning_json: [...new Set(w)],
    });
    if (refereeId != null) lastRefereeId = refereeId;
    bumpOpponentCount(dayOpponentCount, p.a, p.b);
  }

  // afternoonCount は計画時点の値。0 の人は午後に1試合も入らなかった
  for (const id of activeIds) {
    if (afternoonCount.get(id)! < 1) {
      meta.unfilledAfternoonReservationIds.push(id);
    }
  }

  if (meta.unfilledMorningReservationIds.length) {
    meta.notes.push("午前に未ペアの予約あり（unfilled_slot 相当・行には未付与）");
  }
  if (meta.unfilledAfternoonReservationIds.length) {
    meta.notes.push("午後に試合が付かない予約あり（奇数・枠不足など）");
  }

  const finalSpread = playCountSpreadForActiveRows(rows, activeIds);
  if (finalSpread > 1) {
    meta.notes.push(
      `全日試合数の最大差が ${finalSpread}（目標は1以内）。空枠必須埋め等で緩和した可能性があります。`
    );
  }

  return { assignments: rows, meta };
}

/** 例外時も API を落とさず固定試合のみ返す */
export function buildMatchingAssignments(params: {
  slots: SlotRow[];
  reservationsActive: ReservationRow[];
  currentAssignments: CurrentAssignmentRow[];
}): BuildMatchingResult {
  try {
    return computeBuildMatchingAssignments(params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const rows: RpcAssignmentRow[] = [];
    const activeIdSet = new Set(params.reservationsActive.map((r) => r.id));
    const rawFixed = params.currentAssignments.filter(
      (a) => a.assignment_type === "morning_fixed" && a.match_phase === "morning"
    );
    const fixed = filterMorningFixedEligibleForActive(rawFixed, activeIdSet);
    for (const f of fixed) {
      const w = Array.isArray(f.warning_json)
        ? (f.warning_json as string[])
        : typeof f.warning_json === "object" && f.warning_json !== null
          ? []
          : [];
      rows.push({
        event_day_slot_id: f.event_day_slot_id,
        match_phase: "morning",
        assignment_type: "morning_fixed",
        reservation_a_id: f.reservation_a_id,
        reservation_b_id: f.reservation_b_id,
        referee_reservation_id: f.referee_reservation_id,
        warning_json: w,
      });
    }
    const all = params.reservationsActive.map((r) => r.id);
    return {
      assignments: rows,
      meta: {
        unfilledMorningReservationIds: all,
        unfilledAfternoonReservationIds: all,
        notes: [`編成例外を捕捉し固定のみ返却: ${msg}`],
      },
    };
  }
}
