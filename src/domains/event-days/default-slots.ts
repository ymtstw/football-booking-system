/**
 * 開催日1件あたりの既定枠定義（午前4・午後4＝計8枠）。
 * POST 開催日時に `event_day_slots` へコピーする元データ。
 *
 * 運用パターンは「6枠運用」または「8枠運用」の2択に限定：
 *  - 6枠運用: 4枠目（MORNING_4 / AFTERNOON_4）を is_active=false にして対象外にする
 *  - 8枠運用: 4枠すべて is_active=true
 *
 * 開催日作成時は「6枠運用」からスタート（4枠目 is_active=false）。管理画面のラジオで切り替える。
 * 枠行自体は常に 4+4=8 で保持し、DB から行を追加・削除することはしない。
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
  /** 作成時の初期の有効・無効（6枠運用スタートのため 4 枠目だけ false） */
  isActive: boolean;
};

/**
 * 芝1面・1時間1枠・各枠最大2チーム（capacity=2）。
 * 午前: 予約で確定。午後: 締切後の自動編成対象。
 * 枠コード順が表示・編成の時間順になる。
 */
export const DEFAULT_EVENT_DAY_SLOT_DEFINITIONS: readonly DefaultSlotDefinition[] =
  [
    {
      slotCode: "MORNING_1",
      phase: "morning",
      startTime: "09:00:00",
      endTime: "10:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "MORNING_2",
      phase: "morning",
      startTime: "10:00:00",
      endTime: "11:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "MORNING_3",
      phase: "morning",
      startTime: "11:00:00",
      endTime: "12:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "MORNING_4",
      phase: "morning",
      startTime: "12:00:00",
      endTime: "13:00:00",
      capacity: 2,
      isActive: false,
    },
    {
      slotCode: "AFTERNOON_1",
      phase: "afternoon",
      startTime: "13:00:00",
      endTime: "14:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "AFTERNOON_2",
      phase: "afternoon",
      startTime: "14:00:00",
      endTime: "15:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "AFTERNOON_3",
      phase: "afternoon",
      startTime: "15:00:00",
      endTime: "16:00:00",
      capacity: 2,
      isActive: true,
    },
    {
      slotCode: "AFTERNOON_4",
      phase: "afternoon",
      startTime: "16:00:00",
      endTime: "17:00:00",
      capacity: 2,
      isActive: false,
    },
  ] as const;

/** 既定テンプレの枠数（物理行の件数。8 固定）。 */
export const DEFAULT_EVENT_DAY_SLOT_COUNT = DEFAULT_EVENT_DAY_SLOT_DEFINITIONS.length;

/**
 * 既定で公開（予約・編成）の対象となる枠数（6枠運用スタート＝6）。
 * UI 文言で「○枠付与」と表示するときなどに使用。
 */
export const DEFAULT_ACTIVE_EVENT_DAY_SLOT_COUNT =
  DEFAULT_EVENT_DAY_SLOT_DEFINITIONS.filter((s) => s.isActive).length;

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
  is_active: boolean;
}> {
  return getDefaultEventDaySlotDefinitions().map((s) => ({
    event_day_id: eventDayId,
    slot_code: s.slotCode,
    phase: s.phase,
    start_time: s.startTime,
    end_time: s.endTime,
    capacity: s.capacity,
    is_active: s.isActive,
  }));
}
