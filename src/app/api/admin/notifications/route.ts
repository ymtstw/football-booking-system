/**
 * 管理用: 通知一覧
 * - `dateBasis` あり: 運営向けメール送信履歴（軽量・日付1日単位など）
 * - `dateBasis` なし: 既存の開催日別・状態別一覧（イベント日運営画面など）
 */
import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_API_DB_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { getAdminUser } from "@/lib/auth/require-admin";
import { tokyoDayStartEndExclusiveUtcIso } from "@/lib/dates/tokyo-day-bounds";
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
  const teams =
    resRow && typeof resRow === "object" && "teams" in resRow ? resRow.teams : null;
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

  const { event_days, reservations, ...rest } = row;
  void event_days;
  void reservations;

  return {
    ...rest,
    eventDate:
      edRow && typeof edRow === "object" && "event_date" in edRow
        ? String((edRow as { event_date?: string }).event_date ?? "")
        : null,
    gradeBand:
      edRow && typeof edRow === "object" && "grade_band" in edRow
        ? String((edRow as { grade_band?: string }).grade_band ?? "")
        : null,
    toEmail: toEmail || null,
    teamName: teamName || null,
    contactName: contactName || null,
  };
}

const SELECT_HISTORY = `
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
    `;

const ALLOWED_STATUS = new Set(["failed", "pending", "sent"]);
const HISTORY_STATUS = new Set(["all", "failed", "pending", "sent"]);

async function handleStaffHistoryGet(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateBasisRaw = sp.get("dateBasis")?.trim() ?? "";
  if (dateBasisRaw !== "eventDate" && dateBasisRaw !== "processedDate") {
    return NextResponse.json(
      { error: "dateBasis は eventDate または processedDate です" },
      { status: 422 }
    );
  }
  const dateBasis = dateBasisRaw as "eventDate" | "processedDate";

  const rawStatus = sp.get("status")?.trim() ?? "all";
  if (!HISTORY_STATUS.has(rawStatus)) {
    return NextResponse.json(
      {
        error:
          "status は all / failed / pending / sent のいずれかです（運営履歴モード）",
      },
      { status: 422 }
    );
  }

  const limitParsed = parseInt(sp.get("limit")?.trim() ?? "20", 10);
  const limit = limitParsed === 50 ? 50 : 20;
  const offset = Math.max(0, parseInt(sp.get("offset")?.trim() ?? "0", 10) || 0);

  const date = sp.get("date")?.trim() ?? "";
  if (date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD 形式で指定してください" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  if (dateBasis === "eventDate" && date !== "") {
    const { data: dayRows, error: dayErr } = await supabase
      .from("event_days")
      .select("id")
      .eq("event_date", date);
    if (dayErr) {
      logAdminApiDbError("GET /api/admin/notifications event_days by date", dayErr);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }
    const eventDayIds = (dayRows ?? [])
      .map((r) => (r as { id?: string }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (eventDayIds.length === 0) {
      return NextResponse.json({
        notifications: [],
        meta: {
          limit,
          offset,
          returned: 0,
          mayHaveMore: false,
        },
      });
    }

    let q = supabase.from("notifications").select(SELECT_HISTORY).in("event_day_id", eventDayIds);

    if (rawStatus !== "all") {
      q = q.eq("status", rawStatus);
    }

    const rangeEnd = offset + limit - 1;
    const { data, error } = await q
      .order("updated_at", { ascending: false })
      .range(offset, rangeEnd);

    if (error) {
      logAdminApiDbError("GET /api/admin/notifications (scoped event dates)", error);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }

    const rows = (data ?? []).map((row) =>
      flattenNotificationRow(row as Record<string, unknown>)
    );

    return NextResponse.json({
      notifications: rows,
      meta: {
        limit,
        offset,
        returned: rows.length,
        mayHaveMore: rows.length === limit,
      },
    });
  }

  let q = supabase.from("notifications").select(SELECT_HISTORY);

  if (dateBasis === "processedDate" && date !== "") {
    const bounds = tokyoDayStartEndExclusiveUtcIso(date);
    if (!bounds) {
      return NextResponse.json({ error: "date が不正です" }, { status: 422 });
    }
    q = q
      .gte("updated_at", bounds.startIsoUtc)
      .lt("updated_at", bounds.endExclusiveIsoUtc);
  }

  if (rawStatus !== "all") {
    q = q.eq("status", rawStatus);
  }

  const rangeEnd = offset + limit - 1;
  const { data, error } = await q
    .order("updated_at", { ascending: false })
    .range(offset, rangeEnd);

  if (error) {
    logAdminApiDbError("GET /api/admin/notifications (staff history)", error);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  const rows = (data ?? []).map((row) =>
    flattenNotificationRow(row as Record<string, unknown>)
  );

  return NextResponse.json({
    notifications: rows,
    meta: {
      limit,
      offset,
      returned: rows.length,
      mayHaveMore: rows.length === limit,
    },
  });
}

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateBasis = request.nextUrl.searchParams.get("dateBasis")?.trim() ?? "";
  if (dateBasis === "eventDate" || dateBasis === "processedDate") {
    return handleStaffHistoryGet(request);
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
  const limitRaw = request.nextUrl.searchParams.get("limit")?.trim() ?? "";

  if (eventDayId) {
    if (!isUuid(eventDayId)) {
      return NextResponse.json(
        { error: "クエリ eventDayId は UUID 形式である必要があります" },
        { status: 400 }
      );
    }

    const scopedLimit = Math.min(300, Math.max(1, parseInt(limitRaw, 10) || 100));

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
      .limit(scopedLimit);

    if (error) {
      logAdminApiDbError("GET /api/admin/notifications eventDayId", error);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }

    const rows = (data ?? []).map((row) => flattenNotificationRow(row));
    return NextResponse.json({
      notifications: rows,
    });
  }

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
    logAdminApiDbError("GET /api/admin/notifications global failed/pending", error);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  const rows = (data ?? []).map((row) =>
    flattenNotificationRow(row as Record<string, unknown>)
  );

  return NextResponse.json({
    notifications: rows,
  });
}
