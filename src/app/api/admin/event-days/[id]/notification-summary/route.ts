/**
 * 開催日ごとの通知・締切周りのサマリ（管理画面用）。
 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

import { TEMPLATE_MATCHING_PROPOSAL } from "@/lib/email/matching-proposal-mail";
import { TEMPLATE_MINIMUM_CANCEL_NOTICE } from "@/lib/email/minimum-cancel-mail";
import { TEMPLATE_DAY_BEFORE_FINAL } from "@/lib/email/day-before-final-mail";

const TEMPLATE_WEATHER_CANCEL_IMMEDIATE = "weather_cancel_immediate";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventDayId } = await context.params;
  if (!eventDayId) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: ed, error: edErr } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, weather_status, reservation_deadline_at, matching_proposal_notice_sent_at, final_day_before_notice_completed_at, weather_day_before_rain_scheduled"
    )
    .eq("id", eventDayId)
    .maybeSingle();

  if (edErr) {
    return NextResponse.json(
      { error: edErr.message, code: edErr.code },
      { status: 500 }
    );
  }
  if (!ed) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const { count: activeReservationCount, error: cErr } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("event_day_id", eventDayId)
    .eq("status", "active");

  if (cErr) {
    return NextResponse.json(
      { error: cErr.message, code: cErr.code },
      { status: 500 }
    );
  }

  const { data: notifRows, error: nErr } = await supabase
    .from("notifications")
    .select("template_key, status")
    .eq("event_day_id", eventDayId);

  if (nErr) {
    return NextResponse.json(
      { error: nErr.message, code: nErr.code },
      { status: 500 }
    );
  }

  const rows = notifRows ?? [];
  const countSent = (key: string) =>
    rows.filter((r) => r.template_key === key && r.status === "sent").length;
  const countPendingOrFailed = (key: string) =>
    rows.filter(
      (r) =>
        r.template_key === key && (r.status === "pending" || r.status === "failed")
    ).length;

  const edExt = ed as {
    matching_proposal_notice_sent_at?: string | null;
    final_day_before_notice_completed_at?: string | null;
    weather_day_before_rain_scheduled?: boolean | null;
  };

  return NextResponse.json({
    eventDayId,
    eventDate: ed.event_date,
    gradeBand: ed.grade_band,
    status: ed.status,
    weatherStatus: ed.weather_status,
    reservationDeadlineAt: ed.reservation_deadline_at,
    activeReservationCount: activeReservationCount ?? 0,
    weatherDayBeforeRainScheduled: Boolean(edExt.weather_day_before_rain_scheduled),
    matchingProposalNoticeSentAt: edExt.matching_proposal_notice_sent_at ?? null,
    finalDayBeforeNoticeCompletedAt: edExt.final_day_before_notice_completed_at ?? null,
    notifications: {
      minimumCancelNotice: {
        sent: countSent(TEMPLATE_MINIMUM_CANCEL_NOTICE),
        pendingOrFailed: countPendingOrFailed(TEMPLATE_MINIMUM_CANCEL_NOTICE),
      },
      matchingProposal: {
        sent: countSent(TEMPLATE_MATCHING_PROPOSAL),
        pendingOrFailed: countPendingOrFailed(TEMPLATE_MATCHING_PROPOSAL),
      },
      weatherCancelImmediate: {
        sent: countSent(TEMPLATE_WEATHER_CANCEL_IMMEDIATE),
        pendingOrFailed: countPendingOrFailed(TEMPLATE_WEATHER_CANCEL_IMMEDIATE),
      },
      dayBeforeFinal: {
        sent: countSent(TEMPLATE_DAY_BEFORE_FINAL),
        pendingOrFailed: countPendingOrFailed(TEMPLATE_DAY_BEFORE_FINAL),
      },
    },
  });
}
