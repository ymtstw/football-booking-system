/**
 * 開催日ごとの枠: 一覧 GET・時刻・有効化 PATCH・枠追加 POST（管理者のみ）。
 * 編集は draft / open かつアクティブな予約が0件のときのみ（予約ありは 409）。
 * 予約が残っている場合の更新は `slots/force` を使用。
 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import {
  appendEventDaySlotRow,
  applySlotPatchRows,
  countActiveReservationsForEventDay,
  isSlotEditableEventDayStatus,
  loadSlotsOrdered,
  parseSlotPatchRowsFromJson,
  SLOTS_BLOCKED_BY_RESERVATIONS_MESSAGE_JA,
  verifySlotIdsBelongToEventDay,
} from "@/lib/event-days/admin-event-day-slot-mutations";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status")
    .eq("id", id)
    .maybeSingle();
  if (dayErr) {
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }
  if (!day) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }
  const slotsResult = await loadSlotsOrdered(supabase, id);
  if (!slotsResult.ok) {
    return NextResponse.json({ error: slotsResult.error }, { status: 500 });
  }
  return NextResponse.json({ eventDay: day, slots: slotsResult.slots });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: eventDayId } = await context.params;
  if (!eventDayId) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedRows = parseSlotPatchRowsFromJson(json);
  if (!parsedRows.ok) {
    return NextResponse.json(
      { error: parsedRows.error },
      { status: parsedRows.status }
    );
  }

  const supabase = createServiceRoleClient();
  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, status")
    .eq("id", eventDayId)
    .maybeSingle();
  if (dayErr) {
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }
  if (!day) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }
  if (!isSlotEditableEventDayStatus(day.status as string)) {
    return NextResponse.json(
      {
        error:
          "枠の編集は公開前（draft）または公開中（open）の開催日にのみ行えます",
      },
      { status: 409 }
    );
  }

  const { count: resCount, errorMessage: resCountErr } =
    await countActiveReservationsForEventDay(supabase, eventDayId);
  if (resCountErr) {
    return NextResponse.json({ error: resCountErr }, { status: 500 });
  }
  if (resCount > 0) {
    return NextResponse.json(
      { error: SLOTS_BLOCKED_BY_RESERVATIONS_MESSAGE_JA, code: "has_reservations" },
      { status: 409 }
    );
  }

  const ids = parsedRows.rows.map((r) => r.id);
  const verify = await verifySlotIdsBelongToEventDay(supabase, eventDayId, ids);
  if (!verify.ok) {
    return NextResponse.json(
      { error: verify.error },
      { status: verify.status }
    );
  }

  const applied = await applySlotPatchRows(
    supabase,
    eventDayId,
    parsedRows.rows
  );
  if (!applied.ok) {
    return NextResponse.json(
      { error: applied.error },
      { status: applied.status }
    );
  }

  const slotsResult = await loadSlotsOrdered(supabase, eventDayId);
  if (!slotsResult.ok) {
    return NextResponse.json({ error: slotsResult.error }, { status: 500 });
  }
  return NextResponse.json({
    eventDay: { id: day.id, status: day.status },
    slots: slotsResult.slots,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: eventDayId } = await context.params;
  if (!eventDayId) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phaseRaw =
    json !== null && typeof json === "object"
      ? (json as Record<string, unknown>).phase
      : null;
  const phase =
    phaseRaw === "morning" || phaseRaw === "afternoon" ? phaseRaw : null;
  if (!phase) {
    return NextResponse.json(
      { error: 'phase は "morning" または "afternoon" を指定してください' },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, status")
    .eq("id", eventDayId)
    .maybeSingle();
  if (dayErr) {
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }
  if (!day) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }
  if (!isSlotEditableEventDayStatus(day.status as string)) {
    return NextResponse.json(
      {
        error:
          "枠の追加は公開前（draft）または公開中（open）の開催日にのみ行えます",
      },
      { status: 409 }
    );
  }

  const { count: resCount, errorMessage: resCountErr } =
    await countActiveReservationsForEventDay(supabase, eventDayId);
  if (resCountErr) {
    return NextResponse.json({ error: resCountErr }, { status: 500 });
  }
  if (resCount > 0) {
    return NextResponse.json(
      { error: SLOTS_BLOCKED_BY_RESERVATIONS_MESSAGE_JA, code: "has_reservations" },
      { status: 409 }
    );
  }

  const inserted = await appendEventDaySlotRow(supabase, eventDayId, phase);
  if (!inserted.ok) {
    return NextResponse.json(
      { error: inserted.error },
      { status: inserted.status }
    );
  }

  return NextResponse.json({ slot: inserted.slot }, { status: 201 });
}
