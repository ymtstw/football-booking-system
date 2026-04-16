/**
 * 管理用: 開催日に紐づく通知一覧（SCR-10 / 前日確定の failed 表示用）
 */
import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const ALLOWED_STATUS = new Set(["failed", "pending", "sent"]);

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventDayId = request.nextUrl.searchParams.get("eventDayId")?.trim() ?? "";
  if (!eventDayId || !isUuid(eventDayId)) {
    return NextResponse.json(
      { error: "クエリ eventDayId（UUID）が必要です" },
      { status: 400 }
    );
  }

  const rawStatus = request.nextUrl.searchParams.get("status")?.trim() ?? "failed";
  if (!ALLOWED_STATUS.has(rawStatus)) {
    return NextResponse.json(
      { error: "status は failed / pending / sent のいずれかです" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, channel, status, template_key, payload_summary, error_message, created_at, reservation_id"
    )
    .eq("event_day_id", eventDayId)
    .eq("status", rawStatus)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({
    notifications: data ?? [],
  });
}
