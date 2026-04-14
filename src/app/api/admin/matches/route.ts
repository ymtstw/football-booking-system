/**
 * 前日確定結果の参照（Phase 2・読み取りのみ）
 * GET ?date=YYYY-MM-DD … 該当開催日の is_current な matching_run・match_assignments に加え、
 * 全日の event_day_slots と午前枠ごとの active 予約（1枠1チームの可視化）を返す。
 */
import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type EventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
};

type MatchingRunRow = {
  id: string;
  event_day_id: string;
  status: string;
  is_current: boolean;
  warning_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type SlotRow = {
  slot_code: string;
  phase: string;
  start_time: string;
  end_time: string;
};

type EventSlotRow = {
  id: string;
  slot_code: string;
  phase: string;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  matching_run_id: string;
  event_day_id: string;
  event_day_slot_id: string;
  match_phase: string;
  assignment_type: string;
  reservation_a_id: string;
  reservation_b_id: string;
  referee_reservation_id: string | null;
  status: string;
  warning_json: unknown;
  manual_override: boolean;
  override_reason: string | null;
  event_day_slots: SlotRow | SlotRow[] | null;
};

type TeamEmbed = {
  team_name: string;
  strength_category: string;
  contact_name: string;
};

type ReservationTeamRow = {
  id: string;
  selected_morning_slot_id: string | null;
  display_name: string | null;
  participant_count: number;
  team_id: string;
  /** PostgREST は 1:1 でも配列で返すことがある */
  teams: TeamEmbed | TeamEmbed[] | null;
};

function singleTeam(
  teams: TeamEmbed | TeamEmbed[] | null | undefined
): TeamEmbed | null {
  if (!teams) return null;
  return Array.isArray(teams) ? teams[0] ?? null : teams;
}

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function slotFromAssignment(row: AssignmentRow): SlotRow | null {
  const s = row.event_day_slots;
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function timeSortKey(slot: SlotRow | null): string {
  if (!slot) return "";
  const st = slot.start_time?.slice(0, 8) ?? "";
  const ph = slot.phase === "morning" ? "0" : "1";
  return `${ph}${st}${slot.slot_code}`;
}

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!date) {
    return NextResponse.json(
      { error: "クエリ date（YYYY-MM-DD）が必要です" },
      { status: 400 }
    );
  }
  if (!isIsoDateOnly(date)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD 形式で指定してください" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: eventDay, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status")
    .eq("event_date", date)
    .maybeSingle();

  if (dayErr) {
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }
  if (!eventDay) {
    return NextResponse.json(
      { error: "指定日の開催日が見つかりません" },
      { status: 404 }
    );
  }

  const day = eventDay as EventDayRow;

  const [{ data: slotRows, error: slotListErr }, { data: allActiveRes, error: allResErr }] =
    await Promise.all([
      supabase
        .from("event_day_slots")
        .select("id, slot_code, phase, start_time, end_time, is_active")
        .eq("event_day_id", day.id)
        .order("slot_code", { ascending: true }),
      supabase
        .from("reservations")
        .select(
          `
        id,
        selected_morning_slot_id,
        display_name,
        participant_count,
        team_id,
        teams ( team_name, strength_category, contact_name )
      `
        )
        .eq("event_day_id", day.id)
        .eq("status", "active"),
    ]);

  if (slotListErr) {
    return NextResponse.json(
      { error: slotListErr.message, code: slotListErr.code },
      { status: 500 }
    );
  }
  if (allResErr) {
    return NextResponse.json(
      { error: allResErr.message, code: allResErr.code },
      { status: 500 }
    );
  }

  const slotsRaw = (slotRows ?? []) as EventSlotRow[];
  const sortedSlots = [...slotsRaw].sort((a, b) => {
    const ph = (p: string) => (p === "morning" ? 0 : 1);
    const d = ph(a.phase) - ph(b.phase);
    if (d !== 0) return d;
    return a.slot_code.localeCompare(b.slot_code);
  });

  const reservationMap = new Map<string, ReservationTeamRow>();
  for (const r of allActiveRes ?? []) {
    reservationMap.set((r as ReservationTeamRow).id, r as ReservationTeamRow);
  }

  const morningBySlot = new Map<string, ReservationTeamRow[]>();
  for (const r of reservationMap.values()) {
    const sid = r.selected_morning_slot_id;
    if (!sid) continue;
    if (!morningBySlot.has(sid)) morningBySlot.set(sid, []);
    morningBySlot.get(sid)!.push(r);
  }
  for (const [, list] of morningBySlot) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  const morningSlotCodeById = new Map(sortedSlots.map((s) => [s.id, s.slot_code]));

  function sideFromMap(reservationId: string) {
    const r = reservationMap.get(reservationId);
    const t = singleTeam(r?.teams);
    if (!t) {
      return {
        reservationId,
        teamName: null as string | null,
        strengthCategory: null as string | null,
        contactName: null as string | null,
        displayName: r?.display_name ?? null,
        participantCount: r?.participant_count ?? null,
      };
    }
    return {
      reservationId,
      teamName: t.team_name,
      strengthCategory: t.strength_category,
      contactName: t.contact_name,
      displayName: r?.display_name ?? null,
      participantCount: r?.participant_count ?? null,
    };
  }

  function buildSlotsOverview(
    afternoonBySlot: Map<string, AssignmentRow>,
    /** 午前の試合に出る予約 ID → その試合の event_day_slot_id（別枠に寄せたペアの可視化用） */
    morningResToMatchSlot: Map<string, string>
  ) {
    return sortedSlots.map((slot) => {
      const base = {
        slotId: slot.id,
        slotCode: slot.slot_code,
        phase: slot.phase,
        startTime: slot.start_time,
        endTime: slot.end_time,
        isActive: slot.is_active,
      };
      if (slot.phase === "morning") {
        const occRaw = morningBySlot.get(slot.id) ?? [];
        // 希望枠の行には予約を残し、試合行が別枠のときは一言注記する（代表枠＝遅い希望枠など別枠のとき）
        return {
          ...base,
          morningOccupants: occRaw.map((row) => {
            const t = singleTeam(row.teams);
            const playSlotId = morningResToMatchSlot.get(row.id);
            let morningMatchNote: string | null = null;
            if (playSlotId != null && playSlotId !== slot.id) {
              const code = morningSlotCodeById.get(playSlotId) ?? playSlotId;
              morningMatchNote = `試合は ${code} 枠`;
            }
            return {
              reservationId: row.id,
              teamName: t?.team_name ?? null,
              strengthCategory: t?.strength_category ?? null,
              displayName: row.display_name,
              morningMatchNote,
            };
          }),
          afternoonAssignment: null as null | {
            assignmentId: string;
            assignmentType: string;
            sideA: ReturnType<typeof sideFromMap>;
            sideB: ReturnType<typeof sideFromMap>;
            referee: ReturnType<typeof sideFromMap> | null;
          },
        };
      }
      const asn = afternoonBySlot.get(slot.id);
      if (!asn) {
        return {
          ...base,
          morningOccupants: [] as {
            reservationId: string;
            teamName: string | null;
            strengthCategory: string | null;
            displayName: string | null;
            morningMatchNote: string | null;
          }[],
          afternoonAssignment: null,
        };
      }
      return {
        ...base,
        morningOccupants: [],
        afternoonAssignment: {
          assignmentId: asn.id,
          assignmentType: asn.assignment_type,
          sideA: sideFromMap(asn.reservation_a_id),
          sideB: sideFromMap(asn.reservation_b_id),
          referee: asn.referee_reservation_id
            ? sideFromMap(asn.referee_reservation_id)
            : null,
        },
      };
    });
  }

  const { data: currentRun, error: runErr } = await supabase
    .from("matching_runs")
    .select(
      "id, event_day_id, status, is_current, warning_count, started_at, finished_at, created_at"
    )
    .eq("event_day_id", day.id)
    .eq("is_current", true)
    .maybeSingle();

  if (runErr) {
    return NextResponse.json(
      { error: runErr.message, code: runErr.code },
      { status: 500 }
    );
  }

  if (!currentRun) {
    return NextResponse.json({
      eventDay: day,
      matchingRun: null,
      assignments: [],
      slotsOverview: buildSlotsOverview(new Map(), new Map()),
    });
  }

  const run = currentRun as MatchingRunRow;

  const { data: rawAssignments, error: asgErr } = await supabase
    .from("match_assignments")
    .select(
      `
      id,
      matching_run_id,
      event_day_id,
      event_day_slot_id,
      match_phase,
      assignment_type,
      reservation_a_id,
      reservation_b_id,
      referee_reservation_id,
      status,
      warning_json,
      manual_override,
      override_reason,
      event_day_slots ( slot_code, phase, start_time, end_time )
    `
    )
    .eq("matching_run_id", run.id);

  if (asgErr) {
    return NextResponse.json(
      { error: asgErr.message, code: asgErr.code },
      { status: 500 }
    );
  }

  const assignmentRows = (rawAssignments ?? []) as AssignmentRow[];

  const afternoonBySlot = new Map<string, AssignmentRow>();
  const morningResToMatchSlot = new Map<string, string>();
  for (const a of assignmentRows) {
    if (a.match_phase === "afternoon") {
      afternoonBySlot.set(a.event_day_slot_id, a);
    } else if (a.match_phase === "morning") {
      morningResToMatchSlot.set(a.reservation_a_id, a.event_day_slot_id);
      morningResToMatchSlot.set(a.reservation_b_id, a.event_day_slot_id);
    }
  }

  const sorted = [...assignmentRows].sort((a, b) =>
    timeSortKey(slotFromAssignment(a)).localeCompare(timeSortKey(slotFromAssignment(b)))
  );

  const assignments = sorted.map((row) => {
    const slot = slotFromAssignment(row);
    return {
      id: row.id,
      slotId: row.event_day_slot_id,
      matchPhase: row.match_phase,
      assignmentType: row.assignment_type,
      status: row.status,
      warningJson: row.warning_json,
      manualOverride: row.manual_override,
      overrideReason: row.override_reason,
      slot: slot
        ? {
            slotCode: slot.slot_code,
            phase: slot.phase,
            startTime: slot.start_time,
            endTime: slot.end_time,
          }
        : null,
      sideA: sideFromMap(row.reservation_a_id),
      sideB: sideFromMap(row.reservation_b_id),
      referee: row.referee_reservation_id
        ? sideFromMap(row.referee_reservation_id)
        : null,
    };
  });

  return NextResponse.json({
    eventDay: day,
    matchingRun: {
      id: run.id,
      status: run.status,
      isCurrent: run.is_current,
      warningCount: run.warning_count,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      createdAt: run.created_at,
    },
    assignments,
    slotsOverview: buildSlotsOverview(afternoonBySlot, morningResToMatchSlot),
  });
}
