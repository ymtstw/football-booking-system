import "server-only";

import { buildMatchingAssignments } from "@/domains/matching/build-matching-assignments";
import { buildRoundRobinAssignments } from "@/domains/matching/build-round-robin-assignments";
import {
  isTournamentFormationMode,
  resolveMatchingAlgorithm,
} from "@/lib/matching/matching-algorithm";
import type { SupabaseClient } from "@supabase/supabase-js";

type RpcApplyResult = {
  success?: boolean;
  error?: string;
  status?: string;
  matchingRunId?: string;
  assignmentCount?: number;
};

export type ApplyMatchingForEventDayResult =
  | {
      ok: true;
      eventDayId: string;
      eventDate: string;
      matchingRunId?: string;
      assignmentCount: number;
      meta: ReturnType<typeof buildMatchingAssignments>["meta"];
      algorithm: "v2" | "legacy";
    }
  | {
      ok: false;
      error:
        | "not_found"
        | "not_locked"
        | "already_matched"
        | "event_not_found"
        | "tournament_not_implemented"
        | "unknown";
      message: string;
    };

/**
 * 開催日1件に対し編成 → `admin_apply_matching_run` を実行する。
 */
export async function applyMatchingForEventDayId(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<ApplyMatchingForEventDayResult> {
  const { data: eventDay, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, formation_mode")
    .eq("id", eventDayId)
    .maybeSingle();

  if (dayErr) {
    throw new Error(dayErr.message);
  }
  if (!eventDay) {
    return { ok: false, error: "not_found", message: "開催日が見つかりません" };
  }

  if (isTournamentFormationMode(eventDay.formation_mode as string | null)) {
    return {
      ok: false,
      error: "tournament_not_implemented",
      message: "トーナメント形式の自動編成は未実装です",
    };
  }

  const algorithm = resolveMatchingAlgorithm({
    formationMode: eventDay.formation_mode as string | null,
  });

  const dayId = eventDay.id as string;

  const { data: slots, error: slotErr } = await supabase
    .from("event_day_slots")
    .select("id, slot_code, phase, is_active")
    .eq("event_day_id", dayId)
    .order("slot_code", { ascending: true });

  if (slotErr) {
    throw new Error(slotErr.message);
  }

  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select(
      `
      id,
      selected_morning_slot_id,
      team_id,
      teams ( strength_category, representative_grade_year )
    `
    )
    .eq("event_day_id", dayId)
    .eq("status", "active");

  if (resErr) {
    throw new Error(resErr.message);
  }

  const { data: currentRun, error: runFetchErr } = await supabase
    .from("matching_runs")
    .select("id")
    .eq("event_day_id", dayId)
    .eq("is_current", true)
    .maybeSingle();

  if (runFetchErr) {
    throw new Error(runFetchErr.message);
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
      throw new Error(asgErr.message);
    }
    currentAssignments = (asg ?? []) as typeof currentAssignments;
  }

  const built =
    algorithm === "legacy"
      ? buildMatchingAssignments({
          slots: (slots ?? []) as Parameters<typeof buildMatchingAssignments>[0]["slots"],
          reservationsActive: (reservations ?? []) as Parameters<
            typeof buildMatchingAssignments
          >[0]["reservationsActive"],
          currentAssignments,
        })
      : buildRoundRobinAssignments({
          slots: (slots ?? []) as Parameters<typeof buildRoundRobinAssignments>[0]["slots"],
          reservationsActive: (reservations ?? []).map((r) => ({ id: r.id as string })),
        });

  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_apply_matching_run", {
    p_event_day_id: dayId,
    p_assignments: built.assignments,
  });

  if (rpcErr) {
    throw new Error(rpcErr.message);
  }

  const result = rpcData as RpcApplyResult;
  if (!result?.success) {
    const err = result?.error ?? "unknown";
    if (err === "not_locked") {
      return {
        ok: false,
        error: "not_locked",
        message: "開催日が locked ではありません",
      };
    }
    if (err === "already_matched") {
      return {
        ok: false,
        error: "already_matched",
        message: "既に午後編成（afternoon_auto）が存在するため再実行できません",
      };
    }
    if (err === "event_not_found") {
      return {
        ok: false,
        error: "event_not_found",
        message: "開催日が見つかりません",
      };
    }
    return {
      ok: false,
      error: "unknown",
      message: err,
    };
  }

  return {
    ok: true,
    eventDayId: dayId,
    eventDate: eventDay.event_date as string,
    matchingRunId: result.matchingRunId,
    assignmentCount: result.assignmentCount ?? built.assignments.length,
    meta: built.meta,
    algorithm,
  };
}
