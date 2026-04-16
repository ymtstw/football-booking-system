/**
 * 開催日1件あたりの既定枠定義（午前3・午後3＝計6枠）。
 * POST 開催日時に `event_day_slots` へコピーする元データ。
 * 枠の追加は管理 API で `event-day-slot-count-policy` に従い、午前4・午後4（計8）まで。
 * 編成は `event_day_slots` の有効行に追従する（`buildMatchingAssignments`）。
 */

/** public.slot_phase ENUM と一致 */
export type DefaultSlotPhase = "morning" | "afternoon";

/** 1 枠分の定義（event_day_id 以外を満たす） */
export type DefaultSlotDefinition = {
  slotCode: string;
  phase: DefaultSlotPhase;
  /**
   * PostgreSQL `time` 向け。`HH:MM` でも可だが、明示的に秒まで書く。
   * Supabase/Postgres は '09:00:00' 形式を解釈する。
   */
  startTime: string;
  endTime: string;
  capacity: number;
};

/**
 * 芝1面・1時間1枠・各枠最大2チーム（capacity=2）。
 * 午前: 予約で確定。午後: 締切後の自動編成対象。
 * 枠コード順が表示・編成の時間順になる（追加枠は API で MORNING_n / AFTERNOON_n を採番）。
 */
export const DEFAULT_EVENT_DAY_SLOT_DEFINITIONS: readonly DefaultSlotDefinition[] =
  [
    {
      slotCode: "MORNING_1",
      phase: "morning",
      startTime: "09:00:00",
      endTime: "10:00:00",
      capacity: 2,
    },
    {
      slotCode: "MORNING_2",
      phase: "morning",
      startTime: "10:00:00",
      endTime: "11:00:00",
      capacity: 2,
    },
    {
      slotCode: "MORNING_3",
      phase: "morning",
      startTime: "11:00:00",
      endTime: "12:00:00",
      capacity: 2,
    },
    {
      slotCode: "AFTERNOON_1",
      phase: "afternoon",
      startTime: "13:00:00",
      endTime: "14:00:00",
      capacity: 2,
    },
    {
      slotCode: "AFTERNOON_2",
      phase: "afternoon",
      startTime: "14:00:00",
      endTime: "15:00:00",
      capacity: 2,
    },
    {
      slotCode: "AFTERNOON_3",
      phase: "afternoon",
      startTime: "15:00:00",
      endTime: "16:00:00",
      capacity: 2,
    },
  ] as const;

/** 既定テンプレの枠数（UI 文言など）。順序は表示・編成ループでそのまま使える。 */
export const DEFAULT_EVENT_DAY_SLOT_COUNT = DEFAULT_EVENT_DAY_SLOT_DEFINITIONS.length;

export function getDefaultEventDaySlotDefinitions(): DefaultSlotDefinition[] {
  return [...DEFAULT_EVENT_DAY_SLOT_DEFINITIONS];
}

/** Supabase insert 用の行オブジェクト（event_day_id のみ後付け） */
export function toEventDaySlotRows(
  eventDayId: string
): Array<{
  event_day_id: string;
  slot_code: string;
  phase: DefaultSlotPhase;
  start_time: string;
  end_time: string;
  capacity: number;
}> {
  return getDefaultEventDaySlotDefinitions().map((s) => ({
    event_day_id: eventDayId,
    slot_code: s.slotCode,
    phase: s.phase,
    start_time: s.startTime,
    end_time: s.endTime,
    capacity: s.capacity,
  }));
}
