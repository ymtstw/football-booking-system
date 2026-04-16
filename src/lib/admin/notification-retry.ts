import "server-only";

import { buildReservationScheduleLines } from "@/lib/day-before/reservation-schedule-lines";
import {
  sendDayBeforeFinalEmailAndUpdateNotification,
  sendOperationalCancelImmediateEmailAndUpdateNotification,
  sendWeatherCancelImmediateEmailAndUpdateNotification,
  TEMPLATE_DAY_BEFORE_FINAL,
  TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE,
  TEMPLATE_WEATHER_CANCEL_IMMEDIATE,
  type DayBeforeFinalVariant,
} from "@/lib/email/day-before-final-mail";
import {
  sendMatchingProposalEmailAndUpdateNotification,
  TEMPLATE_MATCHING_PROPOSAL,
} from "@/lib/email/matching-proposal-mail";
import {
  sendMinimumCancelNoticeEmailAndUpdateNotification,
  TEMPLATE_MINIMUM_CANCEL_NOTICE,
} from "@/lib/email/minimum-cancel-mail";
import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_RESERVATION_CREATED = "reservation_created";

export type NotificationRetryResult =
  | { ok: true; status: "sent" | "pending" | "failed" }
  | { ok: false; error: string; statusCode: number };

type NotificationRow = {
  id: string;
  event_day_id: string | null;
  reservation_id: string | null;
  template_key: string | null;
  status: string;
  payload_summary: unknown;
};

async function loadReservationContact(
  supabase: SupabaseClient,
  reservationId: string
): Promise<{
  teamName: string;
  contactName: string;
  contactEmail: string;
} | null> {
  const { data: r, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      teams ( team_name, contact_name, contact_email )
    `
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (error || !r) return null;
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
  if (!contactEmail) return null;
  return {
    teamName: teamName || "（チーム名未設定）",
    contactName: contactName || "ご担当者",
    contactEmail,
  };
}

async function buildDayBeforeFinalRetryContext(
  supabase: SupabaseClient,
  eventDayId: string,
  reservationId: string
): Promise<
  | {
      variant: DayBeforeFinalVariant;
      weatherNotes: string | null;
      operationalCancellationNotice: string | null;
      scheduleLines: string[];
      eventDate: string;
      gradeBand: string | null;
    }
  | null
> {
  const { data: ed, error: edErr } = await supabase
    .from("event_days")
    .select(
      "id, event_date, grade_band, status, operational_cancellation_notice, weather_day_before_rain_scheduled"
    )
    .eq("id", eventDayId)
    .maybeSingle();
  if (edErr || !ed) return null;

  const { data: latestWd } = await supabase
    .from("weather_decisions")
    .select("decision, notes")
    .eq("event_day_id", eventDayId)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = ed.status as string;
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

  const edExt = ed as { operational_cancellation_notice?: string | null };
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

  const scheduleLines = await buildReservationScheduleLines(supabase, eventDayId, reservationId);

  return {
    variant,
    weatherNotes,
    operationalCancellationNotice,
    scheduleLines,
    eventDate: ed.event_date as string,
    gradeBand: (ed.grade_band as string) ?? null,
  };
}

/**
 * failed の通知行を pending に戻してから、テンプレに応じて送信処理を再実行する。
 * `reservation_created` は確認コード平文が無いため未対応。
 */
export async function retryFailedNotificationById(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotificationRetryResult> {
  const { data: n, error: nErr } = await supabase
    .from("notifications")
    .select("id, event_day_id, reservation_id, template_key, status, payload_summary")
    .eq("id", notificationId)
    .maybeSingle();

  if (nErr) {
    return { ok: false, error: nErr.message, statusCode: 500 };
  }
  const row = n as NotificationRow | null;
  if (!row) {
    return { ok: false, error: "通知が見つかりません", statusCode: 404 };
  }
  if (row.status !== "failed") {
    return {
      ok: false,
      error: "再送できるのは status が failed の行のみです",
      statusCode: 409,
    };
  }

  const templateKey = row.template_key?.trim() ?? "";
  if (templateKey === TEMPLATE_RESERVATION_CREATED) {
    return {
      ok: false,
      error:
        "予約完了メール（確認コード同封）はセキュリティ上ここから再送できません。Resend ダッシュボードで配信を確認するか、利用者に予約確認ページの案内を別途送ってください。",
      statusCode: 422,
    };
  }

  if (!row.reservation_id) {
    return { ok: false, error: "reservation_id が無い通知は再送できません", statusCode: 422 };
  }
  if (!row.event_day_id) {
    return { ok: false, error: "event_day_id が無い通知は再送できません", statusCode: 422 };
  }

  const contact = await loadReservationContact(supabase, row.reservation_id);
  if (!contact) {
    return {
      ok: false,
      error: "予約または連絡先メールが取得できません",
      statusCode: 422,
    };
  }

  const { error: upErr } = await supabase
    .from("notifications")
    .update({ status: "pending", error_message: null })
    .eq("id", notificationId)
    .eq("status", "failed");

  if (upErr) {
    return { ok: false, error: upErr.message, statusCode: 500 };
  }

  const { reservation_id: reservationId, event_day_id: eventDayId } = row;

  try {
    if (templateKey === TEMPLATE_MATCHING_PROPOSAL) {
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();
      const scheduleLines = await buildReservationScheduleLines(
        supabase,
        eventDayId,
        reservationId
      );
      await sendMatchingProposalEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName: contact.teamName,
        eventDateIso: (ed?.event_date as string) ?? null,
        gradeBand: (ed?.grade_band as string) ?? null,
        scheduleLines,
      });
    } else if (templateKey === TEMPLATE_MINIMUM_CANCEL_NOTICE) {
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();
      await sendMinimumCancelNoticeEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName: contact.teamName,
        eventDateIso: (ed?.event_date as string) ?? null,
        gradeBand: (ed?.grade_band as string) ?? null,
      });
    } else if (templateKey === TEMPLATE_DAY_BEFORE_FINAL) {
      const ctx = await buildDayBeforeFinalRetryContext(supabase, eventDayId, reservationId);
      if (!ctx) {
        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error_message: "開催日情報の取得に失敗しました（再送中断）",
          })
          .eq("id", notificationId);
        return { ok: false, error: "開催日情報の取得に失敗しました", statusCode: 500 };
      }
      await sendDayBeforeFinalEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName: contact.teamName,
        eventDateIso: ctx.eventDate,
        gradeBand: ctx.gradeBand,
        variant: ctx.variant,
        weatherNotes: ctx.weatherNotes,
        operationalCancellationNotice: ctx.operationalCancellationNotice,
        scheduleLines: ctx.scheduleLines,
      });
    } else if (templateKey === TEMPLATE_WEATHER_CANCEL_IMMEDIATE) {
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();
      const { data: latestWd } = await supabase
        .from("weather_decisions")
        .select("notes")
        .eq("event_day_id", eventDayId)
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const notes = (latestWd?.notes as string | null)?.trim() || null;
      await sendWeatherCancelImmediateEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName: contact.teamName,
        eventDateIso: (ed?.event_date as string) ?? null,
        gradeBand: (ed?.grade_band as string) ?? null,
        weatherNotes: notes,
      });
    } else if (templateKey === TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE) {
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band, operational_cancellation_notice")
        .eq("id", eventDayId)
        .maybeSingle();
      const notice = String(
        (ed as { operational_cancellation_notice?: string } | null)?.operational_cancellation_notice ??
          ""
      ).trim();
      if (!notice) {
        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error_message: "運営中止のお知らせ文が空のため再送できません（開催日を確認してください）",
          })
          .eq("id", notificationId);
        return {
          ok: false,
          error: "運営中止のお知らせ文が空です。開催日データを修正してから再送してください。",
          statusCode: 422,
        };
      }
      await sendOperationalCancelImmediateEmailAndUpdateNotification({
        supabase,
        reservationId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName: contact.teamName,
        eventDateIso: (ed?.event_date as string) ?? null,
        gradeBand: (ed?.grade_band as string) ?? null,
        operationalNotice: notice,
      });
    } else {
      await supabase
        .from("notifications")
        .update({
          status: "failed",
          error_message: `再送未対応の template_key: ${templateKey}`,
        })
        .eq("id", notificationId);
      return {
        ok: false,
        error: `このテンプレートは再送未対応です: ${templateKey || "（なし）"}`,
        statusCode: 422,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "再送処理で例外が発生しました";
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("id", notificationId);
    return { ok: false, error: msg, statusCode: 500 };
  }

  const { data: after } = await supabase
    .from("notifications")
    .select("status")
    .eq("id", notificationId)
    .maybeSingle();

  const st = (after?.status as string) ?? "pending";
  if (st === "sent") {
    return { ok: true, status: "sent" };
  }
  if (st === "failed") {
    return { ok: true, status: "failed" };
  }
  return { ok: true, status: "pending" };
}
