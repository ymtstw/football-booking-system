/** 公開 GET: token（平文 URL）で予約照会。PATCH: 締切前・有効な予約の一部項目のみ更新。 */
import { NextResponse } from "next/server";

import {
  rateLimitReservationTokenGet,
  rateLimitReservationTokenPatch,
} from "@/lib/rate-limit/reservation-public";
import {
  hashReservationTokenPlain,
  isReservationLookupExpired,
  isValidReservationTokenFormat,
  normalizeReservationTokenPlain,
} from "@/lib/reservations/token";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  isContactPhoneDigitsValid,
  normalizeContactPhoneDigits,
} from "@/lib/validators/contact-phone";

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
  team_id: string;
  status: string;
  participant_count: number;
  created_at: string;
  event_days: EventDayRow;
  teams: TeamRow;
  event_day_slots: SlotRow;
  meal_orders: MealRow | MealRow[] | null;
};

const RESERVATION_SELECT = `
      id,
      team_id,
      status,
      participant_count,
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
    `;

function mealCount(row: ReservationRow): number {
  const m = row.meal_orders;
  if (m === null || m === undefined) return 0;
  const first = Array.isArray(m) ? m[0] : m;
  return first?.meal_count ?? 0;
}

function reservationJson(row: ReservationRow) {
  const ed = row.event_days;
  const slot = row.event_day_slots;
  const slotObj =
    slot && !Array.isArray(slot)
      ? slot
      : Array.isArray(slot)
        ? slot[0] ?? null
        : null;

  return {
    reservation: {
      id: row.id,
      status: row.status,
      participantCount: row.participant_count,
      mealCount: mealCount(row),
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
  };
}

function parsePatchBody(raw: unknown): {
  participantCount: number;
  mealCount: number;
  contactName: string;
  contactPhoneDigits: string;
} | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const participantCount =
    typeof o.participantCount === "number" && Number.isFinite(o.participantCount)
      ? o.participantCount
      : NaN;
  const mealCount =
    typeof o.mealCount === "number" && Number.isFinite(o.mealCount)
      ? o.mealCount
      : NaN;
  const contactName =
    typeof o.contactName === "string" ? o.contactName.trim() : "";
  const contactPhoneRaw =
    typeof o.contactPhone === "string" ? o.contactPhone.trim() : "";
  const contactPhoneDigits = normalizeContactPhoneDigits(contactPhoneRaw);

  if (!Number.isInteger(participantCount) || participantCount < 1) return null;
  if (!Number.isInteger(mealCount) || mealCount < 0) return null;
  if (!contactName) return null;
  if (!isContactPhoneDigitsValid(contactPhoneDigits)) return null;

  return { participantCount, mealCount, contactName, contactPhoneDigits };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const limited = rateLimitReservationTokenGet(request);
  if (limited) return limited;

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
    .select(RESERVATION_SELECT)
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

  return NextResponse.json(reservationJson(row));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const limited = rateLimitReservationTokenPatch(request);
  if (limited) return limited;

  const { token: rawToken } = await context.params;
  const token = normalizeReservationTokenPlain(rawToken ?? "");

  if (!isValidReservationTokenFormat(token)) {
    return NextResponse.json(
      { error: "確認コードの形式が不正です" },
      { status: 404 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePatchBody(json);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "参加人数（1以上の整数）・昼食数（0以上の整数）・代表者名・電話（数字10〜15桁）を確認してください",
      },
      { status: 422 }
    );
  }

  const tokenHash = hashReservationTokenPlain(token);
  const supabase = createServiceRoleClient();

  const { data: before, error: fetchErr } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("reservation_token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: fetchErr.message, code: fetchErr.code },
      { status: 500 }
    );
  }

  if (!before) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const row = before as unknown as ReservationRow;
  const ed = row.event_days;

  if (isReservationLookupExpired(ed.event_date)) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  if (row.status !== "active") {
    return NextResponse.json(
      { error: "有効な予約のみ変更できます" },
      { status: 409 }
    );
  }

  const deadline = new Date(ed.reservation_deadline_at).getTime();
  if (!Number.isFinite(deadline) || Date.now() >= deadline) {
    return NextResponse.json(
      { error: "締切を過ぎているため、ここからは変更できません" },
      { status: 409 }
    );
  }

  const { participantCount, mealCount, contactName, contactPhoneDigits } =
    parsed;

  const { error: rErr } = await supabase
    .from("reservations")
    .update({ participant_count: participantCount })
    .eq("id", row.id)
    .eq("status", "active");

  if (rErr) {
    return NextResponse.json(
      { error: rErr.message, code: rErr.code },
      { status: 500 }
    );
  }

  const { error: mErr } = await supabase
    .from("meal_orders")
    .update({ meal_count: mealCount })
    .eq("reservation_id", row.id);

  if (mErr) {
    return NextResponse.json(
      { error: mErr.message, code: mErr.code },
      { status: 500 }
    );
  }

  const { error: tErr } = await supabase
    .from("teams")
    .update({
      contact_name: contactName,
      contact_phone: contactPhoneDigits,
    })
    .eq("id", row.team_id);

  if (tErr) {
    return NextResponse.json(
      { error: tErr.message, code: tErr.code },
      { status: 500 }
    );
  }

  const { data: after, error: afterErr } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", row.id)
    .maybeSingle();

  if (afterErr || !after) {
    return NextResponse.json({ updated: true });
  }

  return NextResponse.json({
    updated: true,
    ...reservationJson(after as unknown as ReservationRow),
  });
}
