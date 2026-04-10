/** 公開 GET: token（平文 URL）で予約照会。ハッシュ照合・開催日から30日超は 404。 */
import { NextResponse } from "next/server";

import {
  hashReservationTokenPlain,
  isReservationLookupExpired,
  isValidReservationTokenFormat,
  normalizeReservationTokenPlain,
} from "@/lib/reservations/token";
import { createServiceRoleClient } from "@/lib/supabase/service";

type EventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
};

type TeamRow = {
  team_name: string;
  strength_category: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

type SlotRow = {
  id: string;
  slot_code: string;
  start_time: string;
  end_time: string;
  phase: string;
} | null;

type MealRow = { meal_count: number } | null;

type ReservationRow = {
  id: string;
  status: string;
  participant_count: number;
  remarks: string | null;
  created_at: string;
  event_days: EventDayRow;
  teams: TeamRow;
  event_day_slots: SlotRow;
  meal_orders: MealRow | MealRow[] | null;
};

function mealCount(row: ReservationRow): number {
  const m = row.meal_orders;
  if (m === null || m === undefined) return 0;
  const first = Array.isArray(m) ? m[0] : m;
  return first?.meal_count ?? 0;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params;
  const token = normalizeReservationTokenPlain(rawToken ?? "");

  if (!isValidReservationTokenFormat(token)) {
    return NextResponse.json(
      { error: "確認コードの形式が不正です" },
      { status: 404 }
    );
  }

  const tokenHash = hashReservationTokenPlain(token);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      participant_count,
      remarks,
      created_at,
      event_days!inner (
        id,
        event_date,
        grade_band,
        status,
        reservation_deadline_at
      ),
      teams!inner (
        team_name,
        strength_category,
        contact_name,
        contact_email,
        contact_phone
      ),
      event_day_slots (
        id,
        slot_code,
        start_time,
        end_time,
        phase
      ),
      meal_orders (
        meal_count
      )
    `
    )
    .eq("reservation_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const row = data as unknown as ReservationRow;
  const ed = row.event_days;

  if (isReservationLookupExpired(ed.event_date)) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const slot = row.event_day_slots;
  const slotObj =
    slot && !Array.isArray(slot)
      ? slot
      : Array.isArray(slot)
        ? slot[0] ?? null
        : null;

  return NextResponse.json({
    reservation: {
      id: row.id,
      status: row.status,
      participantCount: row.participant_count,
      mealCount: mealCount(row),
      remarks: row.remarks ?? "",
      createdAt: row.created_at,
      eventDay: {
        id: ed.id,
        eventDate: ed.event_date,
        gradeBand: ed.grade_band,
        status: ed.status,
        reservationDeadlineAt: ed.reservation_deadline_at,
      },
      morningSlot: slotObj
        ? {
            id: slotObj.id,
            slotCode: slotObj.slot_code,
            startTime: slotObj.start_time,
            endTime: slotObj.end_time,
            phase: slotObj.phase,
          }
        : null,
      team: {
        teamName: row.teams.team_name,
        strengthCategory: row.teams.strength_category,
        contactName: row.teams.contact_name,
        contactEmail: row.teams.contact_email,
        contactPhone: row.teams.contact_phone,
      },
    },
  });
}
