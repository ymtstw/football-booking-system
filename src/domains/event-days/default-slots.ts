/**
 * 開催日1件あたりの既定枠定義（午前6・午後4＝計10枠の物理行）。
 * POST 開催日時に `event_day_slots` へコピーする元データ。
 *
 * V2 運用:
 *  - U-1 / U-2: 30分×6（午前のみ・9:00–12:00）
 *  - U-3〜U-6: 45分×4（午前）+ 昼休憩 + 45分×2（午後13:00–14:30）
 *
 * 管理画面で時刻・有効化は後から変更可能。行の追加・削除はしない。
 */

import { isUnder2GradeBand } from "@/lib/event-days/grade-band";

/** public.slot_phase ENUM と一致 */
export type DefaultSlotPhase = "morning" | "afternoon";

/** 1 枠分の定義（event_day_id 以外を満たす） */
export type DefaultSlotDefinition = {
  slotCode: string;
  phase: DefaultSlotPhase;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
};

/** U-1 / U-2: 30分×6・午前のみ */
export const UNDER_2_SLOT_DEFINITIONS: readonly DefaultSlotDefinition[] = [
  {
    slotCode: "MORNING_1",
    phase: "morning",
    startTime: "09:00:00",
    endTime: "09:30:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_2",
    phase: "morning",
    startTime: "09:30:00",
    endTime: "10:00:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_3",
    phase: "morning",
    startTime: "10:00:00",
    endTime: "10:30:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_4",
    phase: "morning",
    startTime: "10:30:00",
    endTime: "11:00:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_5",
    phase: "morning",
    startTime: "11:00:00",
    endTime: "11:30:00",
    capacity: 2,
    isActive: true,
  },
  {
    slotCode: "MORNING_6",
    phase: "morning",
    startTime: "11:30:00",
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
    isActive: false,
  },
  {
    slotCode: "AFTERNOON_2",
    phase: "afternoon",
    startTime: "13:45:00",
    endTime: "14:30:00",
    capacity: 2,
    isActive: false,
  },
  {
    slotCode: "AFTERNOON_3",
    phase: "afternoon",
    startTime: "14:30:00",
    endTime: "15:15:00",
    capacity: 2,
    isActive: false,
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

/** U-3〜U-6: 45分・午前4+午後2（計6枠有効） */
export const UNDER_3_PLUS_SLOT_DEFINITIONS: readonly DefaultSlotDefinition[] = [
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
    slotCode: "MORNING_5",
    phase: "morning",
    startTime: "11:00:00",
    endTime: "11:30:00",
    capacity: 2,
    isActive: false,
  },
  {
    slotCode: "MORNING_6",
    phase: "morning",
    startTime: "11:30:00",
    endTime: "12:00:00",
    capacity: 2,
    isActive: false,
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
    isActive: false,
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

/** @deprecated レガシー互換（旧6枠・1時間） */
export const DEFAULT_EVENT_DAY_SLOT_DEFINITIONS: readonly DefaultSlotDefinition[] =
  UNDER_3_PLUS_SLOT_DEFINITIONS;

/** @deprecated レガシー互換 */
export const EIGHT_SLOT_STANDARD_DEFINITIONS: readonly DefaultSlotDefinition[] =
  UNDER_3_PLUS_SLOT_DEFINITIONS;

export const DEFAULT_EVENT_DAY_SLOT_COUNT = 10;

export const DEFAULT_ACTIVE_EVENT_DAY_SLOT_COUNT = UNDER_3_PLUS_SLOT_DEFINITIONS.filter(
  (s) => s.isActive
).length;

export type DefaultSlotPreset = "under_2" | "under_3_plus" | "six" | "eight";

export function isDefaultSlotPreset(value: unknown): value is DefaultSlotPreset {
  return (
    value === "under_2" ||
    value === "under_3_plus" ||
    value === "six" ||
    value === "eight"
  );
}

export function defaultSlotPresetForGradeBand(gradeBand: string): DefaultSlotPreset {
  return isUnder2GradeBand(gradeBand) ? "under_2" : "under_3_plus";
}

function slotDefinitionsForPreset(preset: DefaultSlotPreset): DefaultSlotDefinition[] {
  if (preset === "under_2") return [...UNDER_2_SLOT_DEFINITIONS];
  if (preset === "under_3_plus" || preset === "six" || preset === "eight") {
    return [...UNDER_3_PLUS_SLOT_DEFINITIONS];
  }
  return [...UNDER_3_PLUS_SLOT_DEFINITIONS];
}

export function getDefaultEventDaySlotDefinitions(
  preset: DefaultSlotPreset = "under_3_plus"
): DefaultSlotDefinition[] {
  return slotDefinitionsForPreset(preset);
}

export function slotTimesByCode(
  preset: DefaultSlotPreset
): ReadonlyMap<string, { startTime: string; endTime: string }> {
  return new Map(
    slotDefinitionsForPreset(preset).map((d) => [
      d.slotCode,
      { startTime: d.startTime, endTime: d.endTime },
    ])
  );
}

/** @deprecated */
export function sixSlotTimesByCode() {
  return slotTimesByCode("under_3_plus");
}

/** @deprecated */
export function eightSlotTimesByCode() {
  return slotTimesByCode("under_3_plus");
}

/** @deprecated */
export function defaultSlotTimesByCode() {
  return eightSlotTimesByCode();
}

export function getDefaultSlotDisplayIntervalsForPhase(
  phase: DefaultSlotPhase,
  preset: DefaultSlotPreset = "under_3_plus"
): readonly { start: string; end: string }[] {
  return slotDefinitionsForPreset(preset)
    .filter((s) => s.phase === phase && s.isActive)
    .map((s) => ({
      start: s.startTime.slice(0, 5),
      end: s.endTime.slice(0, 5),
    }));
}

/** Supabase insert 用の行オブジェクト */
export function toEventDaySlotRows(
  eventDayId: string,
  presetOrGradeBand: DefaultSlotPreset | string = "under_3_plus"
): Array<{
  event_day_id: string;
  slot_code: string;
  phase: DefaultSlotPhase;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}> {
  const preset = isDefaultSlotPreset(presetOrGradeBand)
    ? presetOrGradeBand
    : defaultSlotPresetForGradeBand(presetOrGradeBand);

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
