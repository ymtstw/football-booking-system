import "server-only";

import {
  ADMIN_API_GENERIC_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import {
  buildReservationScheduleLines,
  buildReservationScheduleRows,
} from "@/lib/day-before/reservation-schedule-lines";
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
import {
  parseMorningSlotForceChangedPayloadSummary,
  sendMorningSlotForceChangedEmailAndUpdateNotification,
  TEMPLATE_MORNING_SLOT_FORCE_CHANGED,
} from "@/lib/email/morning-slot-force-changed-mail";
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
  notificationId: string,
  opts?: { resolvedBy?: string; resolvedNote?: string }
): Promise<NotificationRetryResult> {
  const { data: n, error: nErr } = await supabase
    .from("notifications")
    .select("id, event_day_id, reservation_id, template_key, status, payload_summary")
    .eq("id", notificationId)
    .maybeSingle();

  if (nErr) {
    logAdminApiDbError("retryFailedNotificationById notifications select", nErr);
    return { ok: false, error: ADMIN_API_GENERIC_ERROR_JA, statusCode: 500 };
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
        "予約完了メール（予約番号・確認コード同封）はセキュリティ上ここから再送できません。Resend ダッシュボードで配信を確認するか、管理画面の予約詳細からメール再送を行ってください。",
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

  // failed は「送信失敗の事実」として残す。再送は新しい pending 行を追加して履歴として管理する。
  const { data: inserted, error: insErr } = await supabase
    .from("notifications")
    .insert({
      event_day_id: row.event_day_id,
      reservation_id: row.reservation_id,
      channel: "email",
      status: "pending",
      template_key: row.template_key,
      payload_summary: row.payload_summary,
      error_message: null,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    logAdminApiDbError("retryFailedNotificationById insert pending notification", insErr);
    return { ok: false, error: ADMIN_API_GENERIC_ERROR_JA, statusCode: 500 };
  }
  const pendingId = String((inserted as { id?: string } | null)?.id ?? "").trim();
  if (!pendingId) {
    return { ok: false, error: ADMIN_API_GENERIC_ERROR_JA, statusCode: 500 };
  }

  const { reservation_id: reservationId, event_day_id: eventDayId } = row;

  try {
    if (templateKey === TEMPLATE_MATCHING_PROPOSAL) {
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();
      const scheduleRows = await buildReservationScheduleRows(
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
        scheduleRows,
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
          .eq("id", pendingId);
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
    } else if (templateKey === TEMPLATE_MORNING_SLOT_FORCE_CHANGED) {
      const payload = parseMorningSlotForceChangedPayloadSummary(row.payload_summary);
      if (!payload) {
        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error_message: "朝枠変更通知の payload_summary が不正のため再送できません",
          })
          .eq("id", pendingId);
        return {
          ok: false,
          error: "通知の保存内容（枠・時刻）が取得できません。開催日を確認してください。",
          statusCode: 422,
        };
      }
      const { data: ed } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();
      const eventDateIso =
        payload.event_date_iso ??
        ((ed?.event_date as string | undefined) ?? null);
      const teamName = payload.team_name?.trim()
        ? payload.team_name.trim()
        : contact.teamName;
      const gradeBand =
        payload.grade_band != null && String(payload.grade_band).trim() !== ""
          ? String(payload.grade_band).trim()
          : ((ed?.grade_band as string | null) ?? null);
      await sendMorningSlotForceChangedEmailAndUpdateNotification({
        supabase,
        notificationId: pendingId,
        to: contact.contactEmail,
        contactName: contact.contactName,
        teamName,
        eventDateIso,
        gradeBand,
        slotCode: payload.slot_code,
        morningStartHm: payload.morning_start_hm,
        morningEndHm: payload.morning_end_hm,
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
          .eq("id", pendingId);
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
        .eq("id", pendingId);
      return {
        ok: false,
        error: `このテンプレートは再送未対応です: ${templateKey || "（なし）"}`,
        statusCode: 422,
      };
    }
  } catch (e) {
    logAdminApiDbError("retryFailedNotificationById template branch catch", e);
    await supabase
      .from("notifications")
      .update({
        status: "failed",
        error_message: "再送処理でエラーが発生しました（サーバーログを確認してください）",
      })
      .eq("id", pendingId);
    return { ok: false, error: ADMIN_API_GENERIC_ERROR_JA, statusCode: 500 };
  }

  const { data: after } = await supabase
    .from("notifications")
    .select("status")
    .eq("id", pendingId)
    .maybeSingle();

  const st = (after?.status as string) ?? "pending";
  if (st === "sent") {
    const resolvedBy = opts?.resolvedBy?.trim() ?? "";
    if (resolvedBy) {
      // 再送が成功した場合、必要なら「未対応」から外す（failed の事実は残す）
      await supabase
        .from("notifications")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          resolved_note: (opts?.resolvedNote ?? "再送により送信成功").trim().slice(0, 2000),
        })
        .eq("id", notificationId)
        .eq("status", "failed");
    }
    return { ok: true, status: "sent" };
  }
  if (st === "failed") {
    return { ok: true, status: "failed" };
  }
  return { ok: true, status: "pending" };
}
