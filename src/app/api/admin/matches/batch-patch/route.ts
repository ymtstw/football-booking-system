/**
 * 編成手動調整の一括保存（ドラフト確定）。単一トランザクション RPC で全行を同時更新する。
 */
import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_API_DB_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import {
  validateMergedMatchAssignments,
  type MergedAsgRow,
  type ResShape,
  type SlotShape,
} from "@/lib/admin/validate-merged-match-assignments";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

type PatchRow = {
  assignmentId: string;
  reservationAId: string;
  reservationBId: string;
  refereeReservationId: string | null;
  eventDaySlotId: string;
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
};

type RunRow = {
  id: string;
  event_day_id: string;
  is_current: boolean;
};

type DayRow = {
  id: string;
  status: string;
};

function logSnapshot(row: Pick<AssignmentRow, "reservation_a_id" | "reservation_b_id" | "referee_reservation_id" | "event_day_slot_id" | "match_phase" | "assignment_type">) {
  return {
    reservation_a_id: row.reservation_a_id,
    reservation_b_id: row.reservation_b_id,
    referee_reservation_id: row.referee_reservation_id,
    event_day_slot_id: row.event_day_slot_id,
    match_phase: row.match_phase,
    assignment_type: row.assignment_type,
  };
}

function parsePatchRow(raw: unknown): PatchRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const assignmentId = typeof o.assignmentId === "string" ? o.assignmentId.trim() : "";
  const reservationAId = typeof o.reservationAId === "string" ? o.reservationAId.trim() : "";
  const reservationBId = typeof o.reservationBId === "string" ? o.reservationBId.trim() : "";
  const eventDaySlotId = typeof o.eventDaySlotId === "string" ? o.eventDaySlotId.trim() : "";
  if (!isUuid(assignmentId) || !isUuid(reservationAId) || !isUuid(reservationBId) || !isUuid(eventDaySlotId)) {
    return null;
  }
  let refereeReservationId: string | null = null;
  if (o.refereeReservationId === null) {
    refereeReservationId = null;
  } else if (typeof o.refereeReservationId === "string" && isUuid(o.refereeReservationId.trim())) {
    refereeReservationId = o.refereeReservationId.trim();
  } else if (o.refereeReservationId === undefined) {
    return null;
  } else {
    return null;
  }
  return {
    assignmentId,
    reservationAId,
    reservationBId,
    refereeReservationId,
    eventDaySlotId,
  };
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { eventDate?: unknown; overrideReason?: unknown; patches?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
  if (!eventDate || !isIsoDateOnly(eventDate)) {
    return NextResponse.json({ error: "eventDate（YYYY-MM-DD）が必要です" }, { status: 400 });
  }

  const overrideReason =
    typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
  if (!overrideReason) {
    return NextResponse.json(
      { error: "overrideReason（調整理由）は必須です" },
      { status: 422 }
    );
  }

  if (!Array.isArray(body.patches) || body.patches.length === 0) {
    return NextResponse.json({ error: "patches は1件以上必要です" }, { status: 422 });
  }

  const patches: PatchRow[] = [];
  for (const raw of body.patches) {
    const p = parsePatchRow(raw);
    if (!p) {
      return NextResponse.json(
        { error: "patches の各要素に assignmentId / reservationAId / reservationBId / eventDaySlotId（UUID）と refereeReservationId（UUID または null）が必要です" },
        { status: 422 }
      );
    }
    if (p.reservationAId === p.reservationBId) {
      return NextResponse.json(
        { error: "reservationAId と reservationBId は別の予約である必要があります" },
        { status: 422 }
      );
    }
    if (p.refereeReservationId !== null && (p.refereeReservationId === p.reservationAId || p.refereeReservationId === p.reservationBId)) {
      return NextResponse.json(
        { error: "審判の予約は A/B と別の予約である必要があります" },
        { status: 422 }
      );
    }
    patches.push(p);
  }

  const patchIds = new Set(patches.map((p) => p.assignmentId));
  if (patchIds.size !== patches.length) {
    return NextResponse.json({ error: "patches 内で assignmentId が重複しています" }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  const { data: dayRaw, error: dayErr } = await supabase
    .from("event_days")
    .select("id, status")
    .eq("event_date", eventDate)
    .maybeSingle();

  if (dayErr) {
    logAdminApiDbError("PATCH /api/admin/matches/batch-patch event_days", dayErr);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }
  if (!dayRaw) {
    return NextResponse.json({ error: "指定日の開催日が見つかりません" }, { status: 404 });
  }

  const day = dayRaw as DayRow;
  if (day.status !== "locked" && day.status !== "confirmed") {
    return NextResponse.json(
      { error: "locked / confirmed の開催日のみ一括保存できます" },
      { status: 422 }
    );
  }

  const { data: runRaw, error: runErr } = await supabase
    .from("matching_runs")
    .select("id, event_day_id, is_current")
    .eq("event_day_id", day.id)
    .eq("is_current", true)
    .maybeSingle();

  if (runErr) {
    logAdminApiDbError("PATCH /api/admin/matches/batch-patch matching_runs", runErr);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }
  if (!runRaw || !(runRaw as RunRow).is_current) {
    return NextResponse.json(
      { error: "current の matching_run が見つかりません" },
      { status: 404 }
    );
  }

  const run = runRaw as RunRow;

  const [{ data: slotRows, error: slotErr }, { data: allAsgRaw, error: allErr }, { data: resRows, error: resErr }] =
    await Promise.all([
      supabase
        .from("event_day_slots")
        .select("id, phase, start_time, end_time, is_active")
        .eq("event_day_id", day.id),
      supabase.from("match_assignments").select("*").eq("matching_run_id", run.id),
      supabase.from("reservations").select("id, team_id, status").eq("event_day_id", day.id),
    ]);

  if (slotErr || allErr || resErr) {
    logAdminApiDbError("PATCH /api/admin/matches/batch-patch prefetch", slotErr ?? allErr ?? resErr);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  const allFull = (allAsgRaw ?? []) as AssignmentRow[];
  const byId = new Map(allFull.map((r) => [r.id, r]));
  for (const p of patches) {
    if (!byId.has(p.assignmentId)) {
      return NextResponse.json(
        { error: `割当 ${p.assignmentId} はこの matching_run に存在しません` },
        { status: 422 }
      );
    }
  }

  const originalsById = new Map<string, MergedAsgRow>();
  for (const row of allFull) {
    originalsById.set(row.id, {
      id: row.id,
      event_day_slot_id: row.event_day_slot_id,
      match_phase: row.match_phase,
      reservation_a_id: row.reservation_a_id,
      reservation_b_id: row.reservation_b_id,
      referee_reservation_id: row.referee_reservation_id,
    });
  }

  const merged: MergedAsgRow[] = allFull.map((row) => {
    const p = patches.find((x) => x.assignmentId === row.id);
    if (!p) {
      return {
        id: row.id,
        event_day_slot_id: row.event_day_slot_id,
        match_phase: row.match_phase,
        reservation_a_id: row.reservation_a_id,
        reservation_b_id: row.reservation_b_id,
        referee_reservation_id: row.referee_reservation_id,
      };
    }
    return {
      id: row.id,
      event_day_slot_id: p.eventDaySlotId,
      match_phase: row.match_phase,
      reservation_a_id: p.reservationAId,
      reservation_b_id: p.reservationBId,
      referee_reservation_id: p.refereeReservationId,
    };
  });

  const slots = (slotRows ?? []) as SlotShape[];
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const resById = new Map<string, ResShape>();
  for (const r of (resRows ?? []) as ResShape[]) {
    resById.set(r.id, r);
  }

  const v = validateMergedMatchAssignments(merged, originalsById, slotById, resById);
  if (!v.ok) {
    return NextResponse.json({ error: v.message }, { status: 422 });
  }

  const beforeById = new Map<string, ReturnType<typeof logSnapshot>>();
  for (const p of patches) {
    const row = byId.get(p.assignmentId)!;
    beforeById.set(p.assignmentId, logSnapshot(row));
  }

  const rpcPatches = patches.map((p) => ({
    assignment_id: p.assignmentId,
    reservation_a_id: p.reservationAId,
    reservation_b_id: p.reservationBId,
    referee_reservation_id: p.refereeReservationId,
    event_day_slot_id: p.eventDaySlotId,
  }));

  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_apply_match_assignment_patches", {
    p_matching_run_id: run.id,
    p_override_reason: overrideReason,
    p_patches: rpcPatches,
  });

  if (rpcErr) {
    logAdminApiDbError("PATCH /api/admin/matches/batch-patch rpc", rpcErr);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  const updatedCount = typeof rpcData === "number" ? rpcData : Number(rpcData);
  if (!Number.isFinite(updatedCount) || updatedCount !== patches.length) {
    console.error("[admin-api] PATCH /api/admin/matches/batch-patch count mismatch", {
      expected: patches.length,
      got: rpcData,
    });
    return NextResponse.json(
      {
        error:
          "一括更新の反映件数が一致しませんでした。対戦表を再読込し、状況を確認してください。",
      },
      { status: 500 }
    );
  }

  const logRows: {
    match_assignment_id: string;
    action_type: string;
    before_json: unknown;
    after_json: unknown;
    changed_by: string;
    reason: string;
  }[] = [];

  for (const p of patches) {
    const row = byId.get(p.assignmentId)!;
    const after = {
      reservation_a_id: p.reservationAId,
      reservation_b_id: p.reservationBId,
      referee_reservation_id: p.refereeReservationId,
      event_day_slot_id: p.eventDaySlotId,
      match_phase: row.match_phase,
      assignment_type: row.assignment_type,
    };
    logRows.push({
      match_assignment_id: p.assignmentId,
      action_type: "manual_patch",
      before_json: beforeById.get(p.assignmentId) ?? null,
      after_json: after,
      changed_by: user.id,
      reason: overrideReason,
    });
  }

  const { error: logErr } = await supabase.from("match_adjustment_logs").insert(logRows);
  if (logErr) {
    logAdminApiDbError("PATCH /api/admin/matches/batch-patch match_adjustment_logs", logErr);
    return NextResponse.json(
      {
        error:
          "割当は更新されましたが監査ログの保存に失敗しました。対戦表を再読込し、手動で記録を確認してください。",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updatedCount });
}
