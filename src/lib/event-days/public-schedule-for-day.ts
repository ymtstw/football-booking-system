/**
 * 公開 GET /api/event-days/[date]/public-schedule と同一のペイロード生成
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";

import type { PublicAvailabilityDayRow } from "./public-availability-for-day";

const PUBLIC_DAY_STATUSES = [
  "open",
  "locked",
  "confirmed",
  "cancelled_weather",
  "cancelled_operational",
  "cancelled_minimum",
] as const;

type SlotEmbed = {
  slot_code: string;
  phase: string;
  start_time: string;
  end_time: string;
};

type AssignmentRow = {
  id: string;
  event_day_slot_id: string;
  match_phase: string;
  assignment_type: string;
  reservation_a_id: string;
  reservation_b_id: string;
  referee_reservation_id: string | null;
  status: string;
  event_day_slots: SlotEmbed | SlotEmbed[] | null;
};

type TeamMini = {
  team_name: string;
  strength_category: string;
  representative_grade_year?: number | null;
};

type ResTeamRow = {
  id: string;
  teams: TeamMini | TeamMini[] | null;
};

/** GET public-schedule / 画面表示と同一の試合一覧要素（割当 UUID は公開しない） */
export type PublicScheduleConfirmedMatch = {
  matchPhase: string;
  assignmentType: string;
  slot: {
    slotCode: string;
    phase: string;
    startTime: string;
    endTime: string;
  } | null;
  sideA: {
    teamName: string;
    strengthCategory: string;
    representativeGradeYear: number | null;
  };
  sideB: {
    teamName: string;
    strengthCategory: string;
    representativeGradeYear: number | null;
  };
  referee: {
    teamName: string;
    strengthCategory: string;
    representativeGradeYear: number | null;
  } | null;
};

export type PublicSchedulePayload = {
  eventDate: string;
  gradeBand: string;
  eventDayStatus: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  confirmedMatches: PublicScheduleConfirmedMatch[] | null;
};

export type ScheduleBuildFailure = {
  ok: false;
  status: 500;
  message: string;
  code?: string;
};

function single<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function slotFromAssignment(row: AssignmentRow): SlotEmbed | null {
  return single(row.event_day_slots);
}

function timeSortKey(slot: SlotEmbed | null, matchPhase: string): string {
  if (!slot) return "";
  const st = slot.start_time?.slice(0, 8) ?? "";
  const ph = matchPhase === "morning" ? "0" : "1";
  return `${ph}${st}${slot.slot_code}`;
}

function publicSide(reservationId: string, map: Map<string, ResTeamRow>) {
  const r = map.get(reservationId);
  const t = single(r?.teams);
  const gyRaw = t?.representative_grade_year;
  const representativeGradeYear =
    typeof gyRaw === "number" && gyRaw >= 1 && gyRaw <= 6 ? gyRaw : null;
  return {
    teamName: t?.team_name?.trim() || "（未取得）",
    strengthCategory: t?.strength_category ?? "unknown",
    representativeGradeYear,
  };
}

/** status / 締切計算は event_days 行から（ルートと同一） */
export async function buildPublicSchedulePayloadForDay(
  supabase: SupabaseClient,
  day: PublicAvailabilityDayRow
): Promise<{ ok: true; payload: PublicSchedulePayload } | ScheduleBuildFailure> {
  const status = String(day.status ?? "");
  const deadlineMs = new Date(day.reservation_deadline_at).getTime();
  const acceptingReservations =
    status === "open" && Number.isFinite(deadlineMs) && Date.now() < deadlineMs;

  if (status !== "confirmed") {
    return {
      ok: true,
      payload: {
        eventDate: day.event_date,
        gradeBand: day.grade_band,
        eventDayStatus: status,
        reservationDeadlineAt: day.reservation_deadline_at,
        acceptingReservations,
        confirmedMatches: null as null,
      },
    };
  }

  const { data: currentRun, error: runErr } = await supabase
    .from("matching_runs")
    .select("id")
    .eq("event_day_id", day.id)
    .eq("is_current", true)
    .maybeSingle();

  if (runErr) {
    logPublicReserveApiSupabaseError(
      `public-schedule matching_runs (${day.event_date})`,
      runErr
    );
    return {
      ok: false,
      status: 500,
      message: PUBLIC_RESERVE_API_READ_ERROR_JA,
      code: runErr.code,
    };
  }

  if (!currentRun?.id) {
    return {
      ok: true,
      payload: {
        eventDate: day.event_date,
        gradeBand: day.grade_band,
        eventDayStatus: status,
        reservationDeadlineAt: day.reservation_deadline_at,
        acceptingReservations,
        confirmedMatches: [] as PublicScheduleConfirmedMatch[],
      },
    };
  }

  const { data: rawAssignments, error: asgErr } = await supabase
    .from("match_assignments")
    .select(
      `
      id,
      event_day_slot_id,
      match_phase,
      assignment_type,
      reservation_a_id,
      reservation_b_id,
      referee_reservation_id,
      status,
      event_day_slots ( slot_code, phase, start_time, end_time )
    `
    )
    .eq("matching_run_id", currentRun.id)
    .eq("status", "scheduled");

  if (asgErr) {
    logPublicReserveApiSupabaseError(
      `public-schedule match_assignments (${day.event_date})`,
      asgErr
    );
    return {
      ok: false,
      status: 500,
      message: PUBLIC_RESERVE_API_READ_ERROR_JA,
      code: asgErr.code,
    };
  }

  const assignmentRows = (rawAssignments ?? []) as AssignmentRow[];
  const resIds = new Set<string>();
  for (const a of assignmentRows) {
    resIds.add(a.reservation_a_id);
    resIds.add(a.reservation_b_id);
    if (a.referee_reservation_id) resIds.add(a.referee_reservation_id);
  }

  const reservationMap = new Map<string, ResTeamRow>();
  const resIdList = [...resIds];
  if (resIdList.length > 0) {
    const { data: resRows, error: resErr } = await supabase
      .from("reservations")
      .select("id, teams ( team_name, strength_category, representative_grade_year )")
      .in("id", resIdList);

    if (resErr) {
      logPublicReserveApiSupabaseError(
        `public-schedule reservations (${day.event_date})`,
        resErr
      );
      return {
        ok: false,
        status: 500,
        message: PUBLIC_RESERVE_API_READ_ERROR_JA,
        code: resErr.code,
      };
    }
    for (const r of resRows ?? []) {
      reservationMap.set(String((r as ResTeamRow).id), r as ResTeamRow);
    }
  }

  const sorted = [...assignmentRows].sort((a, b) =>
    timeSortKey(slotFromAssignment(a), a.match_phase).localeCompare(
      timeSortKey(slotFromAssignment(b), b.match_phase)
    )
  );

  const confirmedMatches = sorted.map((row) => {
    const slot = slotFromAssignment(row);
    return {
      matchPhase: row.match_phase,
      assignmentType: row.assignment_type,
      slot: slot
        ? {
            slotCode: slot.slot_code,
            phase: slot.phase,
            startTime: slot.start_time,
            endTime: slot.end_time,
          }
        : null,
      sideA: publicSide(row.reservation_a_id, reservationMap),
      sideB: publicSide(row.reservation_b_id, reservationMap),
      referee: row.referee_reservation_id
        ? publicSide(row.referee_reservation_id, reservationMap)
        : null,
    };
  });

  return {
    ok: true,
    payload: {
      eventDate: day.event_date,
      gradeBand: day.grade_band,
      eventDayStatus: status,
      reservationDeadlineAt: day.reservation_deadline_at,
      acceptingReservations,
      confirmedMatches,
    },
  };
}

/** event_days の公開ステータス一覧（availability / public-schedule と整合） */
export function publicEventDayStatuses(): readonly string[] {
  return PUBLIC_DAY_STATUSES;
}
