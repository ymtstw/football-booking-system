/**
 * 管理用: 通知一覧（開催日指定 or 全体の failed など）
 */
import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** PostgREST のネストをフラット化（一覧 UI 用） */
function flattenNotificationRow(row: Record<string, unknown>) {
  const ed = row.event_days;
  const edRow = Array.isArray(ed) ? ed[0] : ed;
  const res = row.reservations;
  const resRow = Array.isArray(res) ? res[0] : res;
  const teams = resRow && typeof resRow === "object" && "teams" in resRow ? resRow.teams : null;
  const teamRow = Array.isArray(teams) ? teams[0] : teams;
  const toEmail =
    teamRow && typeof teamRow === "object" && "contact_email" in teamRow
      ? String((teamRow as { contact_email?: string }).contact_email ?? "").trim()
      : "";
  const teamName =
    teamRow && typeof teamRow === "object" && "team_name" in teamRow
      ? String((teamRow as { team_name?: string }).team_name ?? "").trim()
      : "";
  const contactName =
    teamRow && typeof teamRow === "object" && "contact_name" in teamRow
      ? String((teamRow as { contact_name?: string }).contact_name ?? "").trim()
      : "";

  const { event_days: _ed, reservations: _rs, ...rest } = row;

  return {
    ...rest,
    eventDate: edRow && typeof edRow === "object" && "event_date" in edRow
      ? String((edRow as { event_date?: string }).event_date ?? "")
      : null,
    gradeBand: edRow && typeof edRow === "object" && "grade_band" in edRow
      ? String((edRow as { grade_band?: string }).grade_band ?? "")
      : null,
    toEmail: toEmail || null,
    teamName: teamName || null,
    contactName: contactName || null,
  };
}

const ALLOWED_STATUS = new Set(["failed", "pending", "sent"]);

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventDayId = request.nextUrl.searchParams.get("eventDayId")?.trim() ?? "";
  const rawStatus = request.nextUrl.searchParams.get("status")?.trim() ?? "failed";
  if (!ALLOWED_STATUS.has(rawStatus)) {
    return NextResponse.json(
      { error: "status は failed / pending / sent のいずれかです" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  if (eventDayId) {
    if (!isUuid(eventDayId)) {
      return NextResponse.json(
        { error: "クエリ eventDayId は UUID 形式である必要があります" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(
        `
      id,
      channel,
      status,
      template_key,
      payload_summary,
      error_message,
      created_at,
      sent_at,
      updated_at,
      reservation_id,
      event_day_id,
      event_days ( event_date, grade_band ),
      reservations (
        teams ( contact_email, contact_name, team_name )
      )
    `
      )
      .eq("event_day_id", eventDayId)
      .eq("status", rawStatus)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    const rows = (data ?? []).map((row) => flattenNotificationRow(row));
    return NextResponse.json({
      notifications: rows,
    });
  }

  // 全体: 直近の失敗等（開催日・宛先メール付き）
  const limitRaw = request.nextUrl.searchParams.get("limit")?.trim() ?? "150";
  const limit = Math.min(300, Math.max(1, parseInt(limitRaw, 10) || 150));

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      channel,
      status,
      template_key,
      payload_summary,
      error_message,
      created_at,
      sent_at,
      updated_at,
      reservation_id,
      event_day_id,
      event_days ( event_date, grade_band ),
      reservations (
        teams ( contact_email, contact_name, team_name )
      )
    `
    )
    .eq("status", rawStatus)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  const rows = (data ?? []).map((row) => flattenNotificationRow(row as Record<string, unknown>));

  return NextResponse.json({
    notifications: rows,
  });
}
