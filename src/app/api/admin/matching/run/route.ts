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

import { authorizeAdminOrCron } from "@/lib/auth/admin-or-cron";
import { applyMatchingForEventDayId } from "@/lib/matching/run-matching-for-event-day";
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
        .select("id")
        .eq("event_date", eventDate)
        .maybeSingle()
    : supabase.from("event_days").select("id").eq("id", eventDayId!).maybeSingle();

  const { data: row, error: dayErr } = await dayQuery;
  if (dayErr) {
    return NextResponse.json({ error: dayErr.message, code: dayErr.code }, { status: 500 });
  }
  if (!row?.id) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  try {
    const result = await applyMatchingForEventDayId(supabase, row.id as string);
    if (!result.ok) {
      if (result.error === "not_locked") {
        return NextResponse.json(
          { error: result.message, status: "not_locked" },
          { status: 422 }
        );
      }
      if (result.error === "already_matched") {
        return NextResponse.json({ error: result.message }, { status: 409 });
      }
      if (result.error === "event_not_found" || result.error === "not_found") {
        return NextResponse.json({ error: result.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      eventDayId: result.eventDayId,
      eventDate: result.eventDate,
      matchingRunId: result.matchingRunId,
      assignmentCount: result.assignmentCount,
      meta: result.meta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
