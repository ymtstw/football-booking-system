/**
 * 開催日の枠数ポリシー（管理画面の追加 API と UI で共有）。
 * 午前・午後は同数で、どちらも 3 または 4 のみ（3+3 または 4+4）。
 */

export const EVENT_DAY_SLOT_MIN_PER_PHASE = 3;
export const EVENT_DAY_SLOT_MAX_PER_PHASE = 4;

/** 説明・エラーメッセージ用（UI / API 共通） */
export const EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA = [
  "午前と午後の枠数は必ず同じにしてください。",
  "「午前3・午後3（計6枠）」または「午前4・午後4（計8枠）」のみ登録できます。",
  "片方だけ先に増やして本数がずれたまま（合計が7など）にしたり、合計が5以下・7・9以上になる構成にはできません。",
  "4枠体制にするときは、午前に1枠追加したら続けて午後にも1枠追加し、必ず4+4に揃えてください。",
].join("");

/** API 用の短い拒否文 */
export const EVENT_DAY_SLOT_APPEND_REJECT_MESSAGE_JA =
  "枠の追加は、午前・午後が揃ったうえでどちらも3枠（計6）またはどちらも4枠（計8）になる場合のみ可能です。合計5以下・7・9以上や、午前午後の不一致は不可です。";

/**
 * 午前・午後の枠本数が運用ルールどおりか（中間状態は含まない）。
 * 例: (4,3) は最終形ではないので false。
 */
export function eventDaySlotPhaseCountsOk(morning: number, afternoon: number): boolean {
  if (morning !== afternoon) return false;
  return (
    morning >= EVENT_DAY_SLOT_MIN_PER_PHASE &&
    morning <= EVENT_DAY_SLOT_MAX_PER_PHASE
  );
}

/**
 * 1枠追加したあとに満たせる状態へ遷移できるか。
 * 許容される中間: (4,3) / (3,4) のみ（あと1本で (4,4) または (3,3) に戻せる）。
 */
export function canAppendEventDaySlotForPhase(
  currentMorning: number,
  currentAfternoon: number,
  phase: "morning" | "afternoon"
): boolean {
  const m = currentMorning + (phase === "morning" ? 1 : 0);
  const a = currentAfternoon + (phase === "afternoon" ? 1 : 0);
  if (m > EVENT_DAY_SLOT_MAX_PER_PHASE || a > EVENT_DAY_SLOT_MAX_PER_PHASE) return false;
  if (m < EVENT_DAY_SLOT_MIN_PER_PHASE || a < EVENT_DAY_SLOT_MIN_PER_PHASE) return false;
  if (Math.abs(m - a) > 1) return false;
  return true;
}
