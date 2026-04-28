/**
 * 開催日1件あたりの既定枠定義（午前4・午後4＝計8枠）。
 * POST 開催日時に `event_day_slots` へコピーする元データ。
 *
 * 運用パターンは「6枠運用」または「8枠運用」の2択に限定：
 *  - 6枠運用: 4枠目（MORNING_4 / AFTERNOON_4）を is_active=false。有効な1〜3枠は **1時間単位**。
 *  - 8枠運用: 4枠すべて is_active=true。**45分連続**の標準テンプレ。
 *
 * 開催日作成時は「6枠運用」からスタート。管理画面のラジオで切替時に、該当モードの標準時刻へ揃える。
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
 * 8枠運用の標準テンプレ（45分×4・連続）。
 * 12:00–13:00 は休憩のため枠を置かない（午前は 12:00 まで、午後は 13:00 から）。
 */
export const EIGHT_SLOT_STANDARD_DEFINITIONS: readonly DefaultSlotDefinition[] = [
  {
    slotCode: "MORNING_1",
    phase: "morning",
    startTime: "09:00:00",
    endTime: "09:45:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_2",
    phase: "morning",
    startTime: "09:45:00",
    endTime: "10:30:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_3",
    phase: "morning",
    startTime: "10:30:00",
    endTime: "11:15:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_4",
    phase: "morning",
    startTime: "11:15:00",
    endTime: "12:00:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "AFTERNOON_1",
    phase: "afternoon",
    startTime: "13:00:00",
    endTime: "13:45:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "AFTERNOON_2",
    phase: "afternoon",
    startTime: "13:45:00",
    endTime: "14:30:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "AFTERNOON_3",
    phase: "afternoon",
    startTime: "14:30:00",
    endTime: "15:15:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "AFTERNOON_4",
    phase: "afternoon",
    startTime: "15:15:00",
    endTime: "16:00:00",
    capacity: 2,
    isActive: true,
  },
] as const;

/**
 * 開催日INSERT・「通常（6枠）」の既定。
 * 有効な1〜3枠は1時間。4枠目は無効だが時刻は8枠テンプレの4枠目（切替時の整合用）。
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
      startTime: "11:15:00",
      endTime: "12:00:00",
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
      startTime: "15:15:00",
      endTime: "16:00:00",
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

/** 6枠運用テンプレの slot_code → 時刻（管理画面「通常」選択時に全行へ適用） */
export function sixSlotTimesByCode(): ReadonlyMap<
  string,
  { startTime: string; endTime: string }
> {
  return new Map(
    DEFAULT_EVENT_DAY_SLOT_DEFINITIONS.map((d) => [
      d.slotCode,
      { startTime: d.startTime, endTime: d.endTime },
    ])
  );
}

/** 8枠運用テンプレの slot_code → 時刻（管理画面「すべて有効」選択時に全行へ適用） */
export function eightSlotTimesByCode(): ReadonlyMap<
  string,
  { startTime: string; endTime: string }
> {
  return new Map(
    EIGHT_SLOT_STANDARD_DEFINITIONS.map((d) => [
      d.slotCode,
      { startTime: d.startTime, endTime: d.endTime },
    ])
  );
}

/**
 * 8枠標準テンプレの時刻マップ（後方互換・既存呼び出し用）。
 * 新規コードは `eightSlotTimesByCode()` を推奨。
 */
export function defaultSlotTimesByCode(): ReadonlyMap<
  string,
  { startTime: string; endTime: string }
> {
  return eightSlotTimesByCode();
}

/**
 * 予約画面など「例示の時刻帯」用。
 * 通常（6枠）の **有効枠のみ** を HH:MM で返す（1時間刻みの例）。
 */
export function getDefaultSlotDisplayIntervalsForPhase(
  phase: DefaultSlotPhase
): readonly { start: string; end: string }[] {
  return DEFAULT_EVENT_DAY_SLOT_DEFINITIONS.filter(
    (s) => s.phase === phase && s.isActive
  ).map((s) => ({
    start: s.startTime.slice(0, 5),
    end: s.endTime.slice(0, 5),
  }));
}

/** 開催日作成時の既定枠テンプレ（6枠運用スタート／8枠運用スタート）。 */
export type DefaultSlotPreset = "six" | "eight";

export function isDefaultSlotPreset(value: unknown): value is DefaultSlotPreset {
  return value === "six" || value === "eight";
}

function slotDefinitionsForPreset(preset: DefaultSlotPreset): DefaultSlotDefinition[] {
  return preset === "eight" ? [...EIGHT_SLOT_STANDARD_DEFINITIONS] : getDefaultEventDaySlotDefinitions();
}

/** Supabase insert 用の行オブジェクト（event_day_id のみ後付け） */
export function toEventDaySlotRows(
  eventDayId: string,
  preset: DefaultSlotPreset = "six"
): Array<{
  event_day_id: string;
  slot_code: string;
  phase: DefaultSlotPhase;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}> {
  return slotDefinitionsForPreset(preset).map((s) => ({
    event_day_id: eventDayId,
    slot_code: s.slotCode,
    phase: s.phase,
    start_time: s.startTime,
    end_time: s.endTime,
    capacity: s.capacity,
    is_active: s.isActive,
  }));
}
