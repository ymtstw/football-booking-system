/**
 * Cron JOB01 と同等の締切処理を 1 開催日だけ実行（Cron 失敗・手動リカバリ用）。
 * 本体: `applyReservationDeadlineCatchupForEventDayId`（最少催行中止分岐・通知含む）。
 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { applyReservationDeadlineCatchupForEventDayId } from "@/lib/event-days/process-reservation-deadline";
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
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, error: message, code: "db" }, { status: 500 });
  }
}
