/**
 * 午後自動編成の取り消し（再実行用）。
 * POST JSON: { "eventDate": "YYYY-MM-DD" } または { "eventDayId": "uuid" } のどちらか一方。
 * 認証: 管理ログインのみ（Cron 不可）。
 *
 * DB: admin_undo_afternoon_matching … confirmed の current run から afternoon_auto と morning_fill を削除し locked に戻す（morning_fixed は残し審判のみ NULL）。
 */
import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
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

type RpcUndoResult = {
  success?: boolean;
  error?: string;
  status?: string;
  deletedAfternoonCount?: number;
  deletedMorningFillCount?: number;
  clearedMorningFixedRefereeCount?: number;
};

export async function POST(request: NextRequest) {
  if (!(await getAdminUser())) {
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
    ? supabase.from("event_days").select("id").eq("event_date", eventDate).maybeSingle()
    : supabase.from("event_days").select("id").eq("id", eventDayId!).maybeSingle();

  const { data: eventDay, error: dayErr } = await dayQuery;
  if (dayErr) {
    return NextResponse.json({ error: dayErr.message, code: dayErr.code }, { status: 500 });
  }
  if (!eventDay) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const dayId = eventDay.id as string;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_undo_afternoon_matching", {
    p_event_day_id: dayId,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message, code: rpcErr.code }, { status: 500 });
  }

  const result = rpcData as RpcUndoResult;
  if (!result?.success) {
    const err = result?.error ?? "unknown";
    if (err === "not_confirmed") {
      return NextResponse.json(
        {
          error: "開催日が confirmed ではありません（巻き戻しは確定済みの日のみ）",
          status: result.status,
        },
        { status: 422 }
      );
    }
    if (err === "no_current_run") {
      return NextResponse.json({ error: "現在の matching_run がありません" }, { status: 422 });
    }
    if (err === "nothing_to_undo") {
      return NextResponse.json(
        { error: "取り消す morning_fill / afternoon_auto の行がありません" },
        { status: 422 }
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
    deletedAfternoonCount: result.deletedAfternoonCount ?? 0,
    deletedMorningFillCount: result.deletedMorningFillCount ?? 0,
    clearedMorningFixedRefereeCount: result.clearedMorningFixedRefereeCount ?? 0,
  });
}
