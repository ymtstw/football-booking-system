/**
 * 開催日の枠数ポリシー（V2）。
 * 物理行は午前6・午後4の計10枠固定。有効化は管理画面で調整。
 */

export const EVENT_DAY_SLOT_MIN_PER_PHASE = 0;
export const EVENT_DAY_SLOT_MAX_MORNING = 6;
export const EVENT_DAY_SLOT_MAX_AFTERNOON = 4;

/** 管理UIの要約 */
export const EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA = [
  "この開催日の試合枠を設定します。",
  "U-2以下: 30分×6（午前のみ）が標準テンプレです。",
  "U-3以上: 45分×4（午前）+ 昼休憩 + 45分×2（午後）が標準テンプレです。",
  "予約が入っている場合は、原則枠数や時刻を変更できません。",
].join("");

export const EVENT_DAY_SLOT_APPEND_REJECT_MESSAGE_JA =
  "枠の追加は許可されていません。開催日は常に午前6・午後4の計10枠で固定です。";

export function eventDaySlotPhaseCountsOk(morning: number, afternoon: number): boolean {
  return (
    morning >= EVENT_DAY_SLOT_MIN_PER_PHASE &&
    morning <= EVENT_DAY_SLOT_MAX_MORNING &&
    afternoon >= EVENT_DAY_SLOT_MIN_PER_PHASE &&
    afternoon <= EVENT_DAY_SLOT_MAX_AFTERNOON &&
    morning + afternoon >= 1
  );
}

export function canAppendEventDaySlotForPhase(
  _currentMorning: number,
  _currentAfternoon: number,
  _phase: "morning" | "afternoon"
): boolean {
  return false;
}
