/**
 * Cron JOB01 と同等の締切処理を 1 開催日だけ実行（Cron 失敗・手動リカバリ用）。
 * 本体: `applyReservationDeadlineCatchupForEventDayId`（最少催行中止分岐・通知含む）。
 * `locked` になった場合は続けて自動編成（`applyMatchingForEventDayId`）まで実行する（Vercel の JOB02 Cron は廃止したため）。
 */
import { NextResponse } from "next/server";

import {
  ADMIN_API_DB_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { getAdminUser } from "@/lib/auth/require-admin";
import { applyReservationDeadlineCatchupForEventDayId } from "@/lib/event-days/process-reservation-deadline";
import { applyMatchingForEventDayId } from "@/lib/matching/run-matching-for-event-day";
import { createServiceRoleClient } from "@/lib/supabase/service";

function readAcknowledged(json: unknown): boolean {
  if (json === null || typeof json !== "object") return false;
  return (json as Record<string, unknown>).acknowledged === true;
}

function statusForCode(
  code: "not_found" | "not_open" | "deadline_not_reached" | "no_change" | "db"
): number {
  switch (code) {
    case "not_found":
      return 404;
    case "not_open":
    case "no_change":
      return 409;
    case "deadline_not_reached":
      return 422;
    case "db":
    default:
      return 500;
  }
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

  if (!readAcknowledged(json)) {
    return NextResponse.json(
      {
        error:
          "緊急実行のため、JSON に acknowledged: true を含めてください（画面の確認チェックと同内容）。",
      },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  try {
    const result = await applyReservationDeadlineCatchupForEventDayId(supabase, eventDayId, nowIso);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: statusForCode(result.code) }
      );
    }
    if (result.outcome !== "locked") {
      return NextResponse.json({ ok: true, outcome: result.outcome });
    }

    try {
      const applied = await applyMatchingForEventDayId(supabase, eventDayId);
      if (!applied.ok) {
        return NextResponse.json({
          ok: true,
          outcome: result.outcome,
          matching: {
            ok: false,
            error: applied.error,
            message: applied.message,
          },
        });
      }
      return NextResponse.json({
        ok: true,
        outcome: result.outcome,
        matching: {
          ok: true,
          matchingRunId: applied.matchingRunId,
          assignmentCount: applied.assignmentCount,
        },
      });
    } catch (e) {
      logAdminApiDbError("POST apply-deadline-catchup applyMatchingForEventDayId", e);
      return NextResponse.json(
        {
          ok: true,
          outcome: result.outcome,
          matching: {
            ok: false,
            error: "exception",
            message: "自動編成の呼び出しに失敗しました。サーバーログを確認してください。",
          },
        },
        { status: 200 }
      );
    }
  } catch (e) {
    logAdminApiDbError("POST apply-deadline-catchup", e);
    return NextResponse.json({ ok: false, error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }
}
