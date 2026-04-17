import "server-only";

import { sendOpsBatchFailureDigestEmail } from "@/lib/email/ops-batch-failure-notify";
import {
  sendMinimumCancelNoticeEmailAndUpdateNotification,
  TEMPLATE_MINIMUM_CANCEL_NOTICE,
} from "@/lib/email/minimum-cancel-mail";
import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_TEAMS_TO_HOLD = 3;

async function sendMinimumCancelNoticesForEventDay(
  supabase: SupabaseClient,
  eventDayId: string,
  eventDate: string,
  gradeBand: string | null
): Promise<{ sent: number; skipped: number; failed: number }> {
  const empty = { sent: 0, skipped: 0, failed: 0 };

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

  if (resErr || !reservations?.length) {
    return empty;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of reservations) {
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
      .eq("template_key", TEMPLATE_MINIMUM_CANCEL_NOTICE)
      .maybeSingle();

    if (existing?.status === "sent") {
      skipped += 1;
      continue;
    }

    if (!existing) {
      const { error: nIns } = await supabase.from("notifications").insert({
        event_day_id: eventDayId,
        reservation_id: reservationId,
        channel: "email",
        status: "pending",
        template_key: TEMPLATE_MINIMUM_CANCEL_NOTICE,
        payload_summary: { event_date: eventDate },
      });
      if (nIns) {
        failed += 1;
        continue;
      }
    } else if (existing.status === "failed") {
      await supabase
        .from("notifications")
        .update({ status: "pending", error_message: null })
        .eq("id", existing.id);
    }

    await sendMinimumCancelNoticeEmailAndUpdateNotification({
      supabase,
      reservationId,
      to: contactEmail,
      contactName: contactName || "ご担当者",
      teamName: teamName || "（チーム名未設定）",
      eventDateIso: eventDate,
      gradeBand,
    });

    const { data: after } = await supabase
      .from("notifications")
      .select("status")
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_MINIMUM_CANCEL_NOTICE)
      .maybeSingle();

    if (after?.status === "sent") sent += 1;
    else if (after?.status === "failed") failed += 1;
    else skipped += 1;
  }

  if (failed > 0) {
    await sendOpsBatchFailureDigestEmail({
      jobLabelJa: "予約締切・最少催行中止の通知（Cron JOB01）",
      templateKey: TEMPLATE_MINIMUM_CANCEL_NOTICE,
      eventDayId,
      eventDateIso: eventDate,
      gradeBand,
      failedCount: failed,
      sentCount: sent,
      skippedCount: skipped,
    });
  }

  return { sent, skipped, failed };
}

/**
 * 予約締切を過ぎた `open` 開催日を処理する。
 * active が MIN_TEAMS_TO_HOLD 未満なら `cancelled_minimum` と即時メール、
 * それ以外は `locked`（続けて JOB02 で編成）。
 */
export async function processReservationDeadlinePassed(
  supabase: SupabaseClient,
  nowIso: string
): Promise<{
  minimumCancelledIds: string[];
  lockedIds: string[];
}> {
  const { data: dueRows, error: listErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band")
    .eq("status", "open")
    .lte("reservation_deadline_at", nowIso);

  if (listErr) {
    throw new Error(listErr.message);
  }

  const minimumCancelledIds: string[] = [];
  const lockedIds: string[] = [];

  for (const row of dueRows ?? []) {
    const id = row.id as string;
    const eventDate = row.event_date as string;
    const gradeBand = (row.grade_band as string) ?? null;

    const { count, error: cErr } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("event_day_id", id)
      .eq("status", "active");

    if (cErr) {
      throw new Error(cErr.message);
    }

    const activeCount = count ?? 0;

    if (activeCount < MIN_TEAMS_TO_HOLD) {
      const { data: updated } = await supabase
        .from("event_days")
        .update({ status: "cancelled_minimum" })
        .eq("id", id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();

      if (updated) {
        minimumCancelledIds.push(id);
        await sendMinimumCancelNoticesForEventDay(
          supabase,
          id,
          eventDate,
          gradeBand
        );
      }
    } else {
      const { data: updated } = await supabase
        .from("event_days")
        .update({ status: "locked" })
        .eq("id", id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();

      if (updated) {
        lockedIds.push(id);
      }
    }
  }

  return { minimumCancelledIds, lockedIds };
}

/** テスト・仕様書用に export */
export { MIN_TEAMS_TO_HOLD };
