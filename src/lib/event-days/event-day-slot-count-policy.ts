/**
 * 開催日の枠数ポリシー（管理画面の追加 API と UI で共有）。
 *
 * 新方針: 開催日作成時に常に 4+4=8 枠を投入し、運用上は
 *  - 「6枠運用」: 各フェーズの4枠目（MORNING_4 / AFTERNOON_4）を is_active=false
 *  - 「8枠運用」: 4枠すべて is_active=true
 * の2パターンのみに限定する。枠行の追加／削除は UI からは行わない。
 *
 * 旧データ（3+3）が残っているケースに備え、バリデーションは 3 も許容したままにしておく。
 */

export const EVENT_DAY_SLOT_MIN_PER_PHASE = 3;
export const EVENT_DAY_SLOT_MAX_PER_PHASE = 4;

/** 管理UIの青枠と揃えた要約（API・エラー文言の参考用） */
export const EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA = [
  "この開催日の試合枠を設定します。",
  "6枠運用：午前3枠、午後3枠。",
  "8枠運用：午前4枠、午後4枠。",
  "8枠運用では、初期設定は各枠は45分ごとの設定になります。",
  "予約が入っている場合は、原則枠数や時刻を変更できません。",
].join("");

/** API 用の短い拒否文（枠追加 API が呼ばれた場合に返す） */
export const EVENT_DAY_SLOT_APPEND_REJECT_MESSAGE_JA =
  "枠の追加は許可されていません。開催日は常に午前4・午後4の計8枠で固定です。";

/**
 * 午前・午後の枠本数が運用ルールどおりか。
 * 新方針では 4+4 のみが正、旧データの 3+3 も互換のため true を返す。
 */
export function eventDaySlotPhaseCountsOk(morning: number, afternoon: number): boolean {
  if (morning !== afternoon) return false;
  return (
    morning >= EVENT_DAY_SLOT_MIN_PER_PHASE &&
    morning <= EVENT_DAY_SLOT_MAX_PER_PHASE
  );
}

/**
 * 枠の追加可否。新方針では常に不可（4+4 固定）。
 * 既存の API からの呼び出しに対して false を返し続ければ、API 側で拒否される。
 */
export function canAppendEventDaySlotForPhase(
  _currentMorning: number,
  _currentAfternoon: number,
  _phase: "morning" | "afternoon"
): boolean {
  return false;
}
