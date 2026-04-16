/**
 * 確定補正（SCR-12）: match_assignments の手動更新。
 * チーム差し替え（予約 ID 差し替え）・午後のみ枠移動・審判の差し替え／解除。
 */
import { NextRequest, NextResponse } from "next/server";

import {
  overlappingTeamConflict,
  slotIntervalMinutes,
  type AssignmentSim,
  type SlotTimes,
} from "@/lib/admin/match-assignment-patch-validation";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

type PatchBody = {
  overrideReason?: unknown;
  reservationAId?: unknown;
  reservationBId?: unknown;
  refereeReservationId?: unknown;
  eventDaySlotId?: unknown;
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

type SlotRow = {
  id: string;
  phase: string;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

type ResRow = {
  id: string;
  team_id: string;
  status: string;
};

function logSnapshot(row: AssignmentRow) {
  return {
    reservation_a_id: row.reservation_a_id,
    reservation_b_id: row.reservation_b_id,
    referee_reservation_id: row.referee_reservation_id,
    event_day_slot_id: row.event_day_slot_id,
    match_phase: row.match_phase,
    assignment_type: row.assignment_type,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: assignmentId } = await context.params;
  if (!assignmentId || !isUuid(assignmentId)) {
    return NextResponse.json({ error: "無効な id です" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const overrideReason =
    typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
  if (!overrideReason) {
    return NextResponse.json(
      { error: "overrideReason（補正理由）は必須です" },
      { status: 422 }
    );
  }

  const ra =
    typeof body.reservationAId === "string" && isUuid(body.reservationAId)
      ? body.reservationAId
      : null;
  const rb =
    typeof body.reservationBId === "string" && isUuid(body.reservationBId)
      ? body.reservationBId
      : null;
  const slotId =
    typeof body.eventDaySlotId === "string" && isUuid(body.eventDaySlotId)
      ? body.eventDaySlotId
      : null;

  if (!ra || !rb || !slotId) {
    return NextResponse.json(
      { error: "reservationAId / reservationBId / eventDaySlotId は必須です" },
      { status: 422 }
    );
  }

  /** undefined のときは後段で現行値を採用（キー省略で審判だけ変えない等） */
  let refereeInput: string | null | undefined;
  if (body.refereeReservationId === null) {
    refereeInput = null;
  } else if (typeof body.refereeReservationId === "string" && isUuid(body.refereeReservationId)) {
    refereeInput = body.refereeReservationId;
  } else if (body.refereeReservationId === undefined) {
    refereeInput = undefined;
  } else {
    return NextResponse.json(
      { error: "refereeReservationId は UUID または null を指定してください" },
      { status: 422 }
    );
  }

  if (ra === rb) {
    return NextResponse.json(
      { error: "reservationAId と reservationBId は別の予約である必要があります" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: asgRaw, error: asgErr } = await supabase
    .from("match_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (asgErr) {
    return NextResponse.json(
      { error: asgErr.message, code: asgErr.code },
      { status: 500 }
    );
  }
  if (!asgRaw) {
    return NextResponse.json({ error: "割当が見つかりません" }, { status: 404 });
  }

  const asg = asgRaw as AssignmentRow;

  const refereeId: string | null =
    refereeInput === undefined ? asg.referee_reservation_id : refereeInput;

  if (refereeId !== null && (refereeId === ra || refereeId === rb)) {
    return NextResponse.json(
      { error: "審判の予約は A/B と別の予約である必要があります" },
      { status: 422 }
    );
  }

  const { data: runRaw, error: runErr } = await supabase
    .from("matching_runs")
    .select("id, event_day_id, is_current")
    .eq("id", asg.matching_run_id)
    .maybeSingle();

  if (runErr) {
    return NextResponse.json(
      { error: runErr.message, code: runErr.code },
      { status: 500 }
    );
  }
  if (!runRaw || !(runRaw as RunRow).is_current) {
    return NextResponse.json(
      { error: "current でない matching_run の割当は補正できません" },
      { status: 409 }
    );
  }

  const run = runRaw as RunRow;
  if (run.event_day_id !== asg.event_day_id) {
    return NextResponse.json({ error: "データ不整合です" }, { status: 500 });
  }

  const { data: dayRaw, error: dayErr } = await supabase
    .from("event_days")
    .select("id, status")
    .eq("id", asg.event_day_id)
    .maybeSingle();

  if (dayErr || !dayRaw) {
    return NextResponse.json(
      { error: dayErr?.message ?? "開催日が見つかりません" },
      { status: 500 }
    );
  }

  const day = dayRaw as DayRow;
  if (day.status !== "locked" && day.status !== "confirmed") {
    return NextResponse.json(
      { error: "locked / confirmed の開催日のみ補正できます" },
      { status: 422 }
    );
  }

  if (
    ra === asg.reservation_a_id &&
    rb === asg.reservation_b_id &&
    refereeId === asg.referee_reservation_id &&
    slotId === asg.event_day_slot_id
  ) {
    return NextResponse.json(
      { error: "変更内容がありません（いずれかの項目を変更してください）" },
      { status: 400 }
    );
  }

  if (asg.match_phase === "morning" && slotId !== asg.event_day_slot_id) {
    return NextResponse.json(
      {
        error:
          "午前試合の枠（event_day_slot_id）変更は未対応です。予約の希望枠・編成の再実行で調整してください",
      },
      { status: 422 }
    );
  }

  const [{ data: slotRows, error: slotErr }, { data: allAsg, error: allErr }, { data: resRows, error: resErr }] =
    await Promise.all([
      supabase
        .from("event_day_slots")
        .select("id, phase, start_time, end_time, is_active")
        .eq("event_day_id", asg.event_day_id),
      supabase
        .from("match_assignments")
        .select(
          "id, event_day_slot_id, match_phase, reservation_a_id, reservation_b_id, referee_reservation_id"
        )
        .eq("matching_run_id", run.id),
      supabase
        .from("reservations")
        .select("id, team_id, status")
        .eq("event_day_id", asg.event_day_id),
    ]);

  if (slotErr || allErr || resErr) {
    const msg = slotErr?.message ?? allErr?.message ?? resErr?.message ?? "取得エラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const slots = (slotRows ?? []) as SlotRow[];
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const targetSlot = slotById.get(slotId);
  if (!targetSlot) {
    return NextResponse.json({ error: "指定の枠が開催日に存在しません" }, { status: 422 });
  }
  if (targetSlot.is_active === false) {
    return NextResponse.json({ error: "無効な枠には移動できません" }, { status: 422 });
  }
  if (targetSlot.phase !== asg.match_phase) {
    return NextResponse.json(
      { error: "午前・午後をまたぐ枠移動はできません" },
      { status: 422 }
    );
  }

  const resById = new Map<string, ResRow>();
  for (const r of (resRows ?? []) as ResRow[]) {
    resById.set(r.id, r);
  }

  const active = (rid: string) => {
    const r = resById.get(rid);
    return r && r.status === "active";
  };
  if (!active(ra) || !active(rb)) {
    return NextResponse.json(
      { error: "A/B には当該開催日の active な予約のみ指定できます" },
      { status: 422 }
    );
  }
  if (refereeId !== null && !active(refereeId)) {
    return NextResponse.json(
      { error: "審判には当該開催日の active な予約のみ指定できます" },
      { status: 422 }
    );
  }

  const teamA = resById.get(ra)!.team_id;
  const teamB = resById.get(rb)!.team_id;
  if (teamA === teamB) {
    return NextResponse.json(
      { error: "同一チーム同士の対戦にはできません（team_id が重複しています）" },
      { status: 422 }
    );
  }
  if (refereeId !== null) {
    const tr = resById.get(refereeId)!.team_id;
    if (tr === teamA || tr === teamB) {
      return NextResponse.json(
        { error: "審判のチームは対戦チームと別である必要があります" },
        { status: 422 }
      );
    }
  }

  type LightAsg = {
    id: string;
    event_day_slot_id: string;
    match_phase: string;
    reservation_a_id: string;
    reservation_b_id: string;
    referee_reservation_id: string | null;
  };
  const allList = (allAsg ?? []) as LightAsg[];
  const others = allList.filter((r) => r.id !== assignmentId);

  if (asg.match_phase === "afternoon") {
    for (const o of others) {
      if (o.match_phase === "afternoon" && o.event_day_slot_id === slotId) {
        return NextResponse.json(
          { error: "移動先の午後枠には既に別の試合割当があります" },
          { status: 409 }
        );
      }
    }
  }

  const simulated: LightAsg[] = allList.map((row) => {
    if (row.id === assignmentId) {
      return {
        id: row.id,
        event_day_slot_id: slotId,
        match_phase: row.match_phase,
        reservation_a_id: ra,
        reservation_b_id: rb,
        referee_reservation_id: refereeId,
      };
    }
    return { ...row };
  });

  const usedRes = new Set<string>();
  for (const row of simulated) {
    for (const rid of [row.reservation_a_id, row.reservation_b_id, row.referee_reservation_id]) {
      if (rid == null) continue;
      if (usedRes.has(rid)) {
        return NextResponse.json(
          { error: "同一予約が複数の試合行に割り当てられる状態になるため保存できません" },
          { status: 422 }
        );
      }
      usedRes.add(rid);
    }
  }

  const simForOverlap: AssignmentSim[] = [];
  for (const row of simulated) {
    const sl = slotById.get(row.event_day_slot_id);
    if (!sl) {
      return NextResponse.json({ error: "枠データが不足しています" }, { status: 500 });
    }
    const st: SlotTimes = {
      id: sl.id,
      phase: sl.phase,
      startTime: sl.start_time,
      endTime: sl.end_time,
    };
    const interval = slotIntervalMinutes(st);
    const teamIds: string[] = [
      resById.get(row.reservation_a_id)!.team_id,
      resById.get(row.reservation_b_id)!.team_id,
    ];
    if (row.referee_reservation_id) {
      teamIds.push(resById.get(row.referee_reservation_id)!.team_id);
    }
    simForOverlap.push({
      assignmentId: row.id,
      slotId: row.event_day_slot_id,
      interval,
      teamIds,
    });
  }

  const overlapErr = overlappingTeamConflict(simForOverlap);
  if (overlapErr) {
    return NextResponse.json({ error: overlapErr }, { status: 422 });
  }

  const before = logSnapshot(asg);
  const after = {
    reservation_a_id: ra,
    reservation_b_id: rb,
    referee_reservation_id: refereeId,
    event_day_slot_id: slotId,
    match_phase: asg.match_phase,
    assignment_type: asg.assignment_type,
  };

  const { error: updErr } = await supabase
    .from("match_assignments")
    .update({
      reservation_a_id: ra,
      reservation_b_id: rb,
      referee_reservation_id: refereeId,
      event_day_slot_id: slotId,
      manual_override: true,
      override_reason: overrideReason,
    })
    .eq("id", assignmentId);

  if (updErr) {
    return NextResponse.json(
      { error: updErr.message, code: updErr.code },
      { status: 500 }
    );
  }

  const { error: logErr } = await supabase.from("match_adjustment_logs").insert({
    match_assignment_id: assignmentId,
    action_type: "manual_patch",
    before_json: before,
    after_json: after,
    changed_by: user.id,
    reason: overrideReason,
  });

  if (logErr) {
    return NextResponse.json(
      {
        error:
          "割当は更新されましたが監査ログの保存に失敗しました。notifications / 手動確認を推奨します",
        code: logErr.code,
        detail: logErr.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
