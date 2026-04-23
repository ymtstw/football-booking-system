/**
 * 公開 GET: 開催日が「確定（confirmed）」のときのみ、現在の matching_run の試合割当を
 * チーム名・枠時刻など閲覧用に返す。連絡先は含めない。認証不要。
 * open / locked 等では confirmedMatches は null（午前状況は /availability を利用）。
 */
import { NextResponse } from "next/server";

import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { createServiceRoleClient } from "@/lib/supabase/service";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

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
};

type ResTeamRow = {
  id: string;
  teams: TeamMini | TeamMini[] | null;
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
  return {
    teamName: t?.team_name?.trim() || "（未取得）",
    strengthCategory: t?.strength_category ?? "unknown",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> }
) {
  const { date: dateParam } = await context.params;
  const eventDate = decodeURIComponent(dateParam ?? "").trim();

  if (!eventDate || !isIsoDateOnly(eventDate)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD で指定してください" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .eq("event_date", eventDate)
    .in("status", [...PUBLIC_DAY_STATUSES])
    .maybeSingle();

  if (dayErr) {
    logPublicReserveApiSupabaseError(
      `GET /api/event-days/${eventDate}/public-schedule event_days`,
      dayErr
    );
    return NextResponse.json(
      { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: dayErr.code },
      { status: 500 }
    );
  }

  if (!day) {
    return NextResponse.json(
      { error: "開催日が見つからないか、公開されていません" },
      { status: 404 }
    );
  }

  const status = String(day.status ?? "");
  const deadlineMs = new Date(day.reservation_deadline_at).getTime();
  const acceptingReservations =
    status === "open" && Number.isFinite(deadlineMs) && Date.now() < deadlineMs;

  if (status !== "confirmed") {
    return NextResponse.json({
      eventDate: day.event_date,
      gradeBand: day.grade_band,
      eventDayStatus: status,
      reservationDeadlineAt: day.reservation_deadline_at,
      acceptingReservations,
      confirmedMatches: null as null,
    });
  }

  const { data: currentRun, error: runErr } = await supabase
    .from("matching_runs")
    .select("id")
    .eq("event_day_id", day.id)
    .eq("is_current", true)
    .maybeSingle();

  if (runErr) {
    logPublicReserveApiSupabaseError(
      `GET /api/event-days/${eventDate}/public-schedule matching_runs`,
      runErr
    );
    return NextResponse.json(
      { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: runErr.code },
      { status: 500 }
    );
  }

  if (!currentRun?.id) {
    return NextResponse.json({
      eventDate: day.event_date,
      gradeBand: day.grade_band,
      eventDayStatus: status,
      reservationDeadlineAt: day.reservation_deadline_at,
      acceptingReservations,
      confirmedMatches: [],
    });
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
      `GET /api/event-days/${eventDate}/public-schedule match_assignments`,
      asgErr
    );
    return NextResponse.json(
      { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: asgErr.code },
      { status: 500 }
    );
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
      .select("id, teams ( team_name, strength_category )")
      .in("id", resIdList);

    if (resErr) {
      logPublicReserveApiSupabaseError(
        `GET /api/event-days/${eventDate}/public-schedule reservations`,
        resErr
      );
      return NextResponse.json(
        { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: resErr.code },
        { status: 500 }
      );
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
      id: row.id,
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

  return NextResponse.json({
    eventDate: day.event_date,
    gradeBand: day.grade_band,
    eventDayStatus: status,
    reservationDeadlineAt: day.reservation_deadline_at,
    acceptingReservations,
    confirmedMatches,
  });
}
