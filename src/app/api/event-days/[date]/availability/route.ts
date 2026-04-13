/**
 * 公開 GET: 指定日の open 開催日について、午前各枠の集計。認証不要。
 * 枠の予約可否は締切・定員等で判定（仕様: docs/spec/reservation-deadline-and-event-status.md）。
 */
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type StrengthCategory = "strong" | "potential";

type SlotAgg = {
  strong: number;
  potential: number;
  unknown: number;
  total: number;
};

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
    .eq("status", "open")
    .maybeSingle();

  if (dayErr) {
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }

  if (!day) {
    return NextResponse.json(
      { error: "開催日が見つからないか、公開されていません" },
      { status: 404 }
    );
  }

  const { data: slots, error: slotsErr } = await supabase
    .from("event_day_slots")
    .select("id, slot_code, phase, start_time, end_time, capacity, is_locked")
    .eq("event_day_id", day.id)
    .eq("phase", "morning")
    .eq("is_active", true)
    .order("slot_code", { ascending: true });

  if (slotsErr) {
    return NextResponse.json(
      { error: slotsErr.message, code: slotsErr.code },
      { status: 500 }
    );
  }

  const { data: resRows, error: resErr } = await supabase
    .from("reservations")
    .select(
      "id, selected_morning_slot_id, created_at, teams ( team_name, strength_category )"
    )
    .eq("event_day_id", day.id)
    .eq("status", "active")
    .not("selected_morning_slot_id", "is", null);

  if (resErr) {
    return NextResponse.json(
      { error: resErr.message, code: resErr.code },
      { status: 500 }
    );
  }

  const aggBySlot = new Map<string, SlotAgg>();
  const bookedBySlot = new Map<
    string,
    Array<{ reservationId: string; teamName: string; strengthCategory: string }>
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
      | { team_name: string; strength_category: StrengthCategory }
      | { team_name: string; strength_category: StrengthCategory }[]
      | null;
    const team = Array.isArray(rawTeams) ? rawTeams[0] : rawTeams;
    const cat = team?.strength_category;
    bucket.total += 1;
    if (cat === "strong") bucket.strong += 1;
    else if (cat === "potential") bucket.potential += 1;
    else bucket.unknown += 1;

    const name = team?.team_name?.trim();
    const resId = row.id as string;
    if (name && resId) {
      const list = bookedBySlot.get(sid);
      if (list) {
        list.push({
          reservationId: resId,
          teamName: name,
          strengthCategory:
            cat === "strong" || cat === "potential" ? cat : "unknown",
        });
      }
    }
  }

  const deadline = new Date(day.reservation_deadline_at).getTime();
  const acceptingReservations =
    Number.isFinite(deadline) && Date.now() < deadline;

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
    const bookable = acceptingReservations && !s.is_locked && !full;

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

  return NextResponse.json({
    eventDate: day.event_date,
    eventDayId: day.id,
    gradeBand: day.grade_band,
    reservationDeadlineAt: day.reservation_deadline_at,
    acceptingReservations,
    morningSlots,
  });
}
