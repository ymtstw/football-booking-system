/**
 * Cron JOB03: 開催前日 17:00 JST 想定の「最終通知」（開催確定 / 雨天中止 / 運営中止 / 編成待ち）。
 *
 * `vercel.json`: `0 8 * * *`（UTC 08:00 = 同日 17:00 Asia/Tokyo）。
 * 雨天: `weather_day_before_rain_scheduled` かつ中止判断があれば、この処理で `cancelled_weather` に確定してから送る。
 * 即時 `weather_cancel_immediate` 済みの予約には `day_before_final` を送らない（二重防止）。
 */
import { type NextRequest, NextResponse } from "next/server";

import { buildReservationScheduleLines } from "@/lib/day-before/reservation-schedule-lines";
import {
  sendDayBeforeFinalEmailAndUpdateNotification,
  type DayBeforeFinalVariant,
} from "@/lib/email/day-before-final-mail";
import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const TEMPLATE_WEATHER_CANCEL_IMMEDIATE = "weather_cancel_immediate";

export async function GET(request: NextRequest) {
  const secret = cronSecretConfigured();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET が未設定か短すぎます（16 文字以上）。ローカルなら .env.local に設定し dev を再起動。本番・Preview は Vercel の Environment Variables に登録してください。",
      },
      { status: 503 }
    );
  }

  if (!authorizeCronBearer(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const tomorrowTokyo = addDaysIsoDate(tokyoIsoDateToday(), 1);
  const nowIso = new Date().toISOString();

  const { data: eventDays, error: dayErr } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, weather_status, operational_cancellation_notice, weather_day_before_rain_scheduled, final_day_before_notice_completed_at"
    )
    .eq("event_date", tomorrowTokyo)
    .in("status", ["confirmed", "cancelled_weather", "cancelled_operational", "locked"]);

  if (dayErr) {
    return NextResponse.json({ ok: false, error: dayErr.message }, { status: 500 });
  }

  const summary: {
    eventDayId: string;
    eventDate: string;
    status: string;
    sent: number;
    skipped: number;
    failed: number;
    skippedReason?: string;
  }[] = [];

  for (const ed of eventDays ?? []) {
    const eventDayId = ed.id as string;
    const eventDate = ed.event_date as string;
    let status = ed.status as string;

    const edExt = ed as {
      final_day_before_notice_completed_at?: string | null;
      weather_day_before_rain_scheduled?: boolean | null;
      operational_cancellation_notice?: string | null;
    };

    if (edExt.final_day_before_notice_completed_at) {
      summary.push({
        eventDayId,
        eventDate,
        status,
        sent: 0,
        skipped: 0,
        failed: 0,
        skippedReason: "final_notice_already_completed",
      });
      continue;
    }

    const { data: latestWd } = await supabase
      .from("weather_decisions")
      .select("decision, notes")
      .eq("event_day_id", eventDayId)
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      edExt.weather_day_before_rain_scheduled === true &&
      latestWd?.decision === "cancel" &&
      status === "confirmed"
    ) {
      const { data: applied } = await supabase
        .from("event_days")
        .update({
          status: "cancelled_weather",
          weather_status: "cancel",
          weather_day_before_rain_scheduled: false,
          status_before_weather_cancel: "confirmed",
        })
        .eq("id", eventDayId)
        .eq("status", "confirmed")
        .select("id")
        .maybeSingle();

      if (applied) {
        status = "cancelled_weather";
      }
    }

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
      summary.push({
        eventDayId,
        eventDate,
        status,
        sent: 0,
        skipped: 0,
        failed: 0,
      });
      continue;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

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

      const { data: imImmediate } = await supabase
        .from("notifications")
        .select("status")
        .eq("reservation_id", reservationId)
        .eq("template_key", TEMPLATE_WEATHER_CANCEL_IMMEDIATE)
        .maybeSingle();

      if (imImmediate?.status === "sent") {
        skipped += 1;
        continue;
      }

      const { data: existing } = await supabase
        .from("notifications")
        .select("id, status")
        .eq("reservation_id", reservationId)
        .eq("template_key", "day_before_final")
        .maybeSingle();

      if (existing?.status === "sent") {
        skipped += 1;
        continue;
      }

      let variant: DayBeforeFinalVariant;
      if (status === "cancelled_weather") {
        variant = "weather_cancel";
      } else if (status === "cancelled_operational") {
        variant = "operational_cancel";
      } else if (status === "locked") {
        variant = "pending_matching";
      } else {
        variant = "held";
      }

      const scheduleLines = await buildReservationScheduleLines(
        supabase,
        eventDayId,
        reservationId
      );

      const operationalCancellationNotice =
        status === "cancelled_operational"
          ? (String(edExt.operational_cancellation_notice ?? "").trim() || null)
          : null;

      const weatherNotes =
        status === "cancelled_operational"
          ? null
          : (latestWd?.notes as string | null)?.trim() ||
            (status === "cancelled_weather"
              ? "雨天（天候）により中止です。"
              : latestWd?.decision === "go"
                ? "天候判断: 実施（go）で登録されています。"
                : null);

      if (!existing) {
        const { error: insErr } = await supabase.from("notifications").insert({
          event_day_id: eventDayId,
          reservation_id: reservationId,
          channel: "email",
          status: "pending",
          template_key: "day_before_final",
          payload_summary: {
            variant,
            event_date: eventDate,
          },
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

      await sendDayBeforeFinalEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contactEmail,
        contactName: contactName || "ご担当者",
        teamName: teamName || "（チーム名未設定）",
        eventDateIso: eventDate,
        gradeBand: (ed.grade_band as string) ?? null,
        variant,
        weatherNotes,
        operationalCancellationNotice,
        scheduleLines,
      });

      const { data: after } = await supabase
        .from("notifications")
        .select("status")
        .eq("reservation_id", reservationId)
        .eq("template_key", "day_before_final")
        .maybeSingle();

      if (after?.status === "sent") sent += 1;
      else if (after?.status === "failed") failed += 1;
      else skipped += 1;
    }

    if (failed === 0) {
      await supabase
        .from("event_days")
        .update({ final_day_before_notice_completed_at: nowIso })
        .eq("id", eventDayId);
    }

    summary.push({ eventDayId, eventDate, status, sent, skipped, failed });
  }

  return NextResponse.json({
    ok: true,
    tomorrowTokyo,
    eventDayCount: eventDays?.length ?? 0,
    summary,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
