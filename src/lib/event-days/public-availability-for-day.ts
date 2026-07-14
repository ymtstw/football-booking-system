/**
 * 公開 GET /api/event-days/[date]/availability と同一のペイロード生成（event_days は呼び出し側で1回だけ取得して渡す）
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";

type StrengthCategory = "strong" | "potential";

type SlotAgg = {
  strong: number;
  potential: number;
  unknown: number;
  total: number;
};

export type PublicAvailabilityDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
  max_teams?: number;
  matching_proposal_notice_sent_at?: string | null;
};

export type PublicAvailabilityPayload = {
  eventDate: string;
  eventDayId: string;
  gradeBand: string;
  eventDayStatus: string;
  reservationDeadlineAt: string;
  acceptingReservations: boolean;
  /** 対戦案内メール送信済み（公開側の「試合スケジュール確定」判定に使用） */
  matchingProposalNoticeSentAt?: string | null;
  activeReservationCount: number;
  maxTeams: number;
  dayFull: boolean;
  remainingTeamSlots: number;
  morningSlots: Array<{
    id: string;
    slotCode: string;
    startTime: string;
    endTime: string;
    capacity: number;
    isLocked: boolean;
    activeCount: number;
    full: boolean;
    bookable: boolean;
    byCategory: { strong: number; potential: number; unknown: number };
    /** 公開側には予約 UUID は含めない（チーム名・学年・強さカテゴリのみ） */
    bookedTeams: Array<{
      teamName: string;
      strengthCategory: string;
      representativeGradeYear: number | null;
    }>;
  }>;
};

export type AvailabilityBuildFailure = {
  ok: false;
  status: 500;
  message: string;
  code?: string;
};

export async function buildPublicAvailabilityPayloadForDay(
  supabase: SupabaseClient,
  day: PublicAvailabilityDayRow
): Promise<{ ok: true; payload: PublicAvailabilityPayload } | AvailabilityBuildFailure> {
  const { data: slots, error: slotsErr } = await supabase
    .from("event_day_slots")
    .select("id, slot_code, phase, start_time, end_time, capacity, is_locked")
    .eq("event_day_id", day.id)
    .eq("phase", "morning")
    .eq("is_active", true)
    .order("slot_code", { ascending: true });

  if (slotsErr) {
    logPublicReserveApiSupabaseError(
      `public-availability slots (${day.event_date})`,
      slotsErr
    );
    return {
      ok: false,
      status: 500,
      message: PUBLIC_RESERVE_API_READ_ERROR_JA,
      code: slotsErr.code,
    };
  }

  const { data: activeAll, error: resErr } = await supabase
    .from("reservations")
    .select(
      "selected_morning_slot_id, created_at, teams ( team_name, strength_category, representative_grade_year )"
    )
    .eq("event_day_id", day.id)
    .eq("status", "active");

  if (resErr) {
    logPublicReserveApiSupabaseError(
      `public-availability reservations (${day.event_date})`,
      resErr
    );
    return {
      ok: false,
      status: 500,
      message: PUBLIC_RESERVE_API_READ_ERROR_JA,
      code: resErr.code,
    };
  }

  const activeReservationTotal = (activeAll ?? []).length;
  const maxTeams =
    typeof day.max_teams === "number" && day.max_teams >= 2 ? day.max_teams : 4;
  const dayFull = activeReservationTotal >= maxTeams;
  const remainingTeamSlots = Math.max(0, maxTeams - activeReservationTotal);
  const resRows = (activeAll ?? []).filter(
    (row) => row.selected_morning_slot_id != null
  );

  const aggBySlot = new Map<string, SlotAgg>();
  const bookedBySlot = new Map<
    string,
    Array<{
      teamName: string;
      strengthCategory: string;
      representativeGradeYear: number | null;
    }>
  >();
  for (const s of slots ?? []) {
    aggBySlot.set(s.id, { strong: 0, potential: 0, unknown: 0, total: 0 });
    bookedBySlot.set(s.id, []);
  }

  const sortedRows = [...(resRows ?? [])].sort(
    (a, b) =>
      new Date(String(a.created_at)).getTime() -
      new Date(String(b.created_at)).getTime()
  );

  for (const row of sortedRows) {
    const sid = row.selected_morning_slot_id as string | null;
    if (!sid) continue;
    const bucket = aggBySlot.get(sid);
    if (!bucket) continue;

    const rawTeams = row.teams as
      | {
          team_name: string;
          strength_category: StrengthCategory;
          representative_grade_year?: number | null;
        }
      | {
          team_name: string;
          strength_category: StrengthCategory;
          representative_grade_year?: number | null;
        }[]
      | null;
    const team = Array.isArray(rawTeams) ? rawTeams[0] : rawTeams;
    const cat = team?.strength_category;
    const gyRaw = team?.representative_grade_year;
    const gradeYear =
      typeof gyRaw === "number" &&
      Number.isInteger(gyRaw) &&
      gyRaw >= 1 &&
      gyRaw <= 6
        ? gyRaw
        : null;
    bucket.total += 1;
    if (cat === "strong") bucket.strong += 1;
    else if (cat === "potential") bucket.potential += 1;
    else bucket.unknown += 1;

    const displayTeamName = team?.team_name?.trim() || "（チーム名未設定）";
    const list = bookedBySlot.get(sid);
    if (list) {
      list.push({
        teamName: displayTeamName,
        strengthCategory:
          cat === "strong" || cat === "potential" ? cat : "unknown",
        representativeGradeYear: gradeYear,
      });
    }
  }

  const deadline = new Date(day.reservation_deadline_at).getTime();
  const status = String(day.status ?? "");
  const acceptingReservations =
    status === "open" && Number.isFinite(deadline) && Date.now() < deadline;

  const morningSlots = (slots ?? []).map((s) => {
    const cap = s.capacity ?? 2;
    const a = aggBySlot.get(s.id) ?? {
      strong: 0,
      potential: 0,
      unknown: 0,
      total: 0,
    };
    const activeCount = a.total;
    const full = activeCount >= cap;
    const bookable =
      status === "open" &&
      acceptingReservations &&
      !dayFull &&
      !s.is_locked &&
      !full;

    return {
      id: s.id,
      slotCode: s.slot_code,
      startTime: s.start_time,
      endTime: s.end_time,
      capacity: cap,
      isLocked: s.is_locked,
      activeCount,
      full,
      bookable,
      byCategory: {
        strong: a.strong,
        potential: a.potential,
        unknown: a.unknown,
      },
      bookedTeams: bookedBySlot.get(s.id) ?? [],
    };
  });

  const payload: PublicAvailabilityPayload = {
    eventDate: day.event_date,
    eventDayId: day.id,
    gradeBand: day.grade_band,
    eventDayStatus: status,
    reservationDeadlineAt: day.reservation_deadline_at,
    acceptingReservations,
    matchingProposalNoticeSentAt: day.matching_proposal_notice_sent_at ?? null,
    activeReservationCount: activeReservationTotal,
    maxTeams,
    dayFull,
    remainingTeamSlots,
    morningSlots,
  };

  return { ok: true, payload };
}
