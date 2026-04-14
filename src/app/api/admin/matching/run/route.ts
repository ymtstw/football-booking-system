/**
 * 締切後の午前補完・午後一括編成（Phase 2・MVP 簡略版）。
 * POST JSON: { "eventDate": "YYYY-MM-DD" } または { "eventDayId": "uuid" } のどちらか必須。
 *
 * 認証: 管理ログイン、または Authorization: Bearer CRON_SECRET（16文字以上・lock Cron と同じ）。
 *
 * 前提・制約（確認事項）:
 * - event_days.status が locked のときのみ実行（open 等は RPC が not_locked で拒否）。
 * - 同一開催日で既に current run に afternoon_auto がある場合は再実行不可（already_matched）。取り消しは `POST /api/admin/matching/undo`。
 * - 奇数チームは午後に入れない分は `meta.unfilledAfternoonReservationIds` に列挙。
 *
 * DB: admin_apply_matching_run（マイグレーション 20260421100000）でトランザクション適用し、status を confirmed にする。
 * 編成ロジックの詳細: `docs/spec/matching-algorithm-impl.md`
 */
import { NextRequest, NextResponse } from "next/server";

import { buildMatchingAssignments } from "@/domains/matching/build-matching-assignments";
import { authorizeAdminOrCron } from "@/lib/auth/admin-or-cron";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

type RpcApplyResult = {
  success?: boolean;
  error?: string;
  status?: string;
  matchingRunId?: string;
  assignmentCount?: number;
};

export async function POST(request: NextRequest) {
  if (!(await authorizeAdminOrCron(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { eventDate?: string; eventDayId?: string };
  const eventDate = body.eventDate?.trim();
  const eventDayId = body.eventDayId?.trim();

  if ((eventDate && eventDayId) || (!eventDate && !eventDayId)) {
    return NextResponse.json(
      { error: "eventDate または eventDayId のどちらか一方を指定してください" },
      { status: 400 }
    );
  }

  if (eventDate && !isIsoDateOnly(eventDate)) {
    return NextResponse.json(
      { error: "eventDate は YYYY-MM-DD 形式で指定してください" },
      { status: 422 }
    );
  }
  if (eventDayId && !UUID_RE.test(eventDayId)) {
    return NextResponse.json({ error: "eventDayId の UUID 形式が不正です" }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  const dayQuery = eventDate
    ? supabase
        .from("event_days")
        .select("id, event_date, grade_band, status")
        .eq("event_date", eventDate)
        .maybeSingle()
    : supabase
        .from("event_days")
        .select("id, event_date, grade_band, status")
        .eq("id", eventDayId!)
        .maybeSingle();

  const { data: eventDay, error: dayErr } = await dayQuery;
  if (dayErr) {
    return NextResponse.json({ error: dayErr.message, code: dayErr.code }, { status: 500 });
  }
  if (!eventDay) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const dayId = eventDay.id as string;

  const { data: slots, error: slotErr } = await supabase
    .from("event_day_slots")
    // is_active: buildMatchingAssignments で false の枠を編成対象外にする
    .select("id, slot_code, phase, is_active")
    .eq("event_day_id", dayId)
    .order("slot_code", { ascending: true });

  if (slotErr) {
    return NextResponse.json({ error: slotErr.message, code: slotErr.code }, { status: 500 });
  }

  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select(
      `
      id,
      selected_morning_slot_id,
      team_id,
      teams ( strength_category )
    `
    )
    .eq("event_day_id", dayId)
    .eq("status", "active");

  if (resErr) {
    return NextResponse.json({ error: resErr.message, code: resErr.code }, { status: 500 });
  }

  const { data: currentRun, error: runFetchErr } = await supabase
    .from("matching_runs")
    .select("id")
    .eq("event_day_id", dayId)
    .eq("is_current", true)
    .maybeSingle();

  if (runFetchErr) {
    return NextResponse.json(
      { error: runFetchErr.message, code: runFetchErr.code },
      { status: 500 }
    );
  }

  let currentAssignments: Parameters<typeof buildMatchingAssignments>[0]["currentAssignments"] =
    [];
  if (currentRun?.id) {
    const { data: asg, error: asgErr } = await supabase
      .from("match_assignments")
      .select(
        "event_day_slot_id, match_phase, assignment_type, reservation_a_id, reservation_b_id, referee_reservation_id, warning_json"
      )
      .eq("matching_run_id", currentRun.id);

    if (asgErr) {
      return NextResponse.json({ error: asgErr.message, code: asgErr.code }, { status: 500 });
    }
    currentAssignments = (asg ?? []) as typeof currentAssignments;
  }

  const built = buildMatchingAssignments({
    slots: (slots ?? []) as Parameters<typeof buildMatchingAssignments>[0]["slots"],
    reservationsActive: (reservations ?? []) as Parameters<
      typeof buildMatchingAssignments
    >[0]["reservationsActive"],
    currentAssignments,
  });

  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_apply_matching_run", {
    p_event_day_id: dayId,
    p_assignments: built.assignments,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: rpcErr.message, code: rpcErr.code },
      { status: 500 }
    );
  }

  const result = rpcData as RpcApplyResult;
  if (!result?.success) {
    const err = result?.error ?? "unknown";
    if (err === "not_locked") {
      return NextResponse.json(
        { error: "開催日が locked ではありません", status: result.status },
        { status: 422 }
      );
    }
    if (err === "already_matched") {
      return NextResponse.json(
        { error: "既に午後編成（afternoon_auto）が存在するため再実行できません" },
        { status: 409 }
      );
    }
    if (err === "event_not_found") {
      return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    eventDayId: dayId,
    eventDate: eventDay.event_date,
    matchingRunId: result.matchingRunId,
    assignmentCount: result.assignmentCount ?? built.assignments.length,
    meta: built.meta,
  });
}
