import "server-only";

import {
  sendMorningSlotForceChangedEmailAndUpdateNotification,
  TEMPLATE_MORNING_SLOT_FORCE_CHANGED,
} from "@/lib/email/morning-slot-force-changed-mail";
import type { SupabaseClient } from "@supabase/supabase-js";

function postgresTimeToHm(t: string | null | undefined): string {
  if (t == null) return "—";
  const s = String(t).trim();
  const part = s.includes("T") ? (s.split("T")[1] ?? s) : s;
  const noTz = part.split("+")[0]?.split("Z")[0] ?? part;
  const m = /^(\d{1,2}):(\d{2})/.exec(noTz);
  if (!m) return s.slice(0, 5);
  const hh = m[1].padStart(2, "0");
  return `${hh}:${m[2]}`;
}

type MorningSlotRow = {
  id: string;
  slot_code: string | null;
  start_time: string | null;
  end_time: string | null;
};

/** `after` 内の送信処理へ渡すジョブ（PATCH 応答前にキューだけ積む） */
export type MorningSlotForceMailJob = {
  notificationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  slotCode: string | null;
  morningStartHm: string;
  morningEndHm: string;
};

/**
 * 強制 PATCH で更新された枠のうち「朝」かつ、当該枠に紐づく active 予約へ
 * `notifications`（pending）を INSERT する。メール送信は呼び出し側で行う。
 */
export async function enqueueMorningSlotForceChangedNotifications(
  supabase: SupabaseClient,
  eventDayId: string,
  patchedSlotIds: string[]
): Promise<MorningSlotForceMailJob[]> {
  const ids = [...new Set(patchedSlotIds.filter((x) => typeof x === "string" && x.length > 0))];
  if (ids.length === 0) {
    return [];
  }

  const { data: morningSlots, error: slotErr } = await supabase
    .from("event_day_slots")
    .select("id, slot_code, start_time, end_time")
    .eq("event_day_id", eventDayId)
    .in("id", ids)
    .eq("phase", "morning");

  if (slotErr || !morningSlots?.length) {
    if (slotErr) {
      console.error("[notify morning slot force] slots", slotErr.message);
    }
    return [];
  }

  const slotRows = morningSlots as MorningSlotRow[];
  const morningSlotIds = slotRows.map((s) => s.id);
  const slotById = new Map(
    slotRows.map((s) => [
      s.id,
      {
        slot_code: s.slot_code,
        startHm: postgresTimeToHm(s.start_time),
        endHm: postgresTimeToHm(s.end_time),
      },
    ])
  );

  const { data: ed, error: edErr } = await supabase
    .from("event_days")
    .select("event_date, grade_band")
    .eq("id", eventDayId)
    .maybeSingle();
  if (edErr || !ed) {
    if (edErr) console.error("[notify morning slot force] event_days", edErr.message);
    return [];
  }

  const eventDateIso = (ed.event_date as string) ?? null;
  const gradeBand = (ed.grade_band as string | null) ?? null;

  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select(
      `
      id,
      selected_morning_slot_id,
      teams ( team_name, contact_name, contact_email )
    `
    )
    .eq("event_day_id", eventDayId)
    .eq("status", "active")
    .in("selected_morning_slot_id", morningSlotIds);

  if (resErr || !reservations?.length) {
    if (resErr) {
      console.error("[notify morning slot force] reservations", resErr.message);
    }
    return [];
  }

  const jobs: MorningSlotForceMailJob[] = [];
  /** 同一 PATCH で複数朝枠が変わっても、予約は朝枠1つなので通常1回だが、念のため二重 INSERT を防ぐ */
  const enqueuedReservationIds = new Set<string>();

  for (const r of reservations) {
    const res = r as {
      id: string;
      selected_morning_slot_id: string | null;
      teams: unknown;
    };
    if (enqueuedReservationIds.has(res.id)) {
      console.warn(
        `[notify morning slot force] skip duplicate reservation row id=${res.id}`
      );
      continue;
    }
    const slotId = res.selected_morning_slot_id;
    if (!slotId) continue;
    const slotInfo = slotById.get(slotId);
    if (!slotInfo) continue;

    const teams = res.teams;
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
      console.warn(
        `[notify morning slot force] skip reservation ${res.id}: no contact_email`
      );
      continue;
    }

    const teamNameForMail = teamName || "（チーム名未設定）";
    const payload_summary = {
      slot_code: slotInfo.slot_code,
      morning_start_hm: slotInfo.startHm,
      morning_end_hm: slotInfo.endHm,
      event_date_iso: eventDateIso,
      team_name: teamNameForMail,
      grade_band: gradeBand,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("notifications")
      .insert({
        event_day_id: eventDayId,
        reservation_id: res.id,
        channel: "email",
        status: "pending",
        template_key: TEMPLATE_MORNING_SLOT_FORCE_CHANGED,
        payload_summary,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      if (insErr) {
        console.error("[notify morning slot force] insert", insErr.message);
      }
      continue;
    }

    enqueuedReservationIds.add(res.id);

    jobs.push({
      notificationId: inserted.id,
      to: contactEmail,
      contactName: contactName || "ご担当者",
      teamName: teamNameForMail,
      eventDateIso,
      gradeBand,
      slotCode: slotInfo.slot_code,
      morningStartHm: slotInfo.startHm,
      morningEndHm: slotInfo.endHm,
    });
  }

  return jobs;
}

/** キュー済みジョブのメール送信（失敗時は各行が failed になる） */
export async function sendMorningSlotForceChangedNotificationJobs(
  supabase: SupabaseClient,
  jobs: MorningSlotForceMailJob[]
): Promise<void> {
  for (const j of jobs) {
    await sendMorningSlotForceChangedEmailAndUpdateNotification({
      supabase,
      notificationId: j.notificationId,
      to: j.to,
      contactName: j.contactName,
      teamName: j.teamName,
      eventDateIso: j.eventDateIso,
      gradeBand: j.gradeBand,
      slotCode: j.slotCode,
      morningStartHm: j.morningStartHm,
      morningEndHm: j.morningEndHm,
    });
  }
}
