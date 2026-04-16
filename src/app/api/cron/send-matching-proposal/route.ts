/**
 * Cron: 開催 2 日前 16:30 JST 想定でマッチング案内メール（matching_proposal）。
 *
 * `vercel.json`: `30 7 * * *`（UTC 07:30 = 同日 16:30 Asia/Tokyo）。
 */
import { type NextRequest, NextResponse } from "next/server";

import { buildReservationScheduleLines } from "@/lib/day-before/reservation-schedule-lines";
import {
  sendMatchingProposalEmailAndUpdateNotification,
  TEMPLATE_MATCHING_PROPOSAL,
} from "@/lib/email/matching-proposal-mail";
import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = cronSecretConfigured();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET が未設定か短すぎます（16 文字以上）。ローカルなら .env.local に設定し dev を再起動。",
      },
      { status: 503 }
    );
  }

  if (!authorizeCronBearer(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const todayTokyo = tokyoIsoDateToday();
  const targetEventDate = addDaysIsoDate(todayTokyo, 2);

  const { data: eventDays, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, matching_proposal_notice_sent_at")
    .eq("event_date", targetEventDate)
    .in("status", ["locked", "confirmed"])
    .is("matching_proposal_notice_sent_at", null);

  if (dayErr) {
    return NextResponse.json({ ok: false, error: dayErr.message }, { status: 500 });
  }

  const summary: {
    eventDayId: string;
    eventDate: string;
    sent: number;
    skipped: number;
    failed: number;
  }[] = [];

  for (const ed of eventDays ?? []) {
    const eventDayId = ed.id as string;
    const eventDate = ed.event_date as string;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const { data: reservations, error: resErr } = await supabase
      .from("reservations")
      .select(
        `
        id,
        teams ( team_name, contact_name, contact_email )
      `
      )
      .eq("event_day_id", eventDayId)
      .eq("status", "active");

    if (resErr) {
      summary.push({ eventDayId, eventDate, sent: 0, skipped: 0, failed: 0 });
      continue;
    }

    for (const r of reservations ?? []) {
      const reservationId = r.id as string;
      const teams = r.teams;
      const teamRow = Array.isArray(teams) ? teams[0] : teams;
      const teamName =
        teamRow && typeof teamRow === "object" && "team_name" in teamRow
          ? String((teamRow as { team_name?: string }).team_name ?? "").trim()
          : "";
      const contactName =
        teamRow && typeof teamRow === "object" && "contact_name" in teamRow
          ? String((teamRow as { contact_name?: string }).contact_name ?? "").trim()
          : "";
      const contactEmail =
        teamRow && typeof teamRow === "object" && "contact_email" in teamRow
          ? String((teamRow as { contact_email?: string }).contact_email ?? "").trim()
          : "";

      if (!contactEmail) {
        skipped += 1;
        continue;
      }

      const { data: existing } = await supabase
        .from("notifications")
        .select("id, status")
        .eq("reservation_id", reservationId)
        .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
        .maybeSingle();

      if (existing?.status === "sent") {
        skipped += 1;
        continue;
      }

      const scheduleLines = await buildReservationScheduleLines(
        supabase,
        eventDayId,
        reservationId
      );

      if (!existing) {
        const { error: insErr } = await supabase.from("notifications").insert({
          event_day_id: eventDayId,
          reservation_id: reservationId,
          channel: "email",
          status: "pending",
          template_key: TEMPLATE_MATCHING_PROPOSAL,
          payload_summary: { event_date: eventDate },
        });
        if (insErr) {
          failed += 1;
          continue;
        }
      } else if (existing.status === "failed") {
        await supabase
          .from("notifications")
          .update({ status: "pending", error_message: null })
          .eq("id", existing.id);
      }

      await sendMatchingProposalEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contactEmail,
        contactName: contactName || "ご担当者",
        teamName: teamName || "（チーム名未設定）",
        eventDateIso: eventDate,
        gradeBand: (ed.grade_band as string) ?? null,
        scheduleLines,
      });

      const { data: after } = await supabase
        .from("notifications")
        .select("status")
        .eq("reservation_id", reservationId)
        .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
        .maybeSingle();

      if (after?.status === "sent") sent += 1;
      else if (after?.status === "failed") failed += 1;
      else skipped += 1;
    }

    if (failed === 0) {
      const { error: stampErr } = await supabase
        .from("event_days")
        .update({ matching_proposal_notice_sent_at: new Date().toISOString() })
        .eq("id", eventDayId)
        .is("matching_proposal_notice_sent_at", null);

      if (stampErr) {
        failed += 1;
      }
    }

    summary.push({ eventDayId, eventDate, sent, skipped, failed });
  }

  return NextResponse.json({
    ok: true,
    todayTokyo,
    targetEventDate,
    eventDayCount: eventDays?.length ?? 0,
    summary,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
