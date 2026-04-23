import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { MAIL_BODY_SERVICE_NAME, MAIL_SUBJECT_BRAND_USER } from "@/lib/email/mail-brand";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_MORNING_SLOT_FORCE_CHANGED = "morning_slot_force_changed";

const ERROR_MESSAGE_MAX = 2000;

function truncateErrorMessage(msg: string): string {
  const t = msg.trim();
  if (t.length <= ERROR_MESSAGE_MAX) return t;
  return `${t.slice(0, ERROR_MESSAGE_MAX - 1)}…`;
}

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reserveContactUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/contact`;
}

export type MorningSlotForceChangedPayloadSummary = {
  slot_code: string | null;
  morning_start_hm: string;
  morning_end_hm: string;
  /** 送信時点の開催日（再送で DB が変わっても本文に反映できる） */
  event_date_iso: string | null;
  /** 送信時点のチーム名 */
  team_name: string | null;
  /** 送信時点の学年帯 */
  grade_band: string | null;
};

/** 再送時に payload_summary を解釈する（旧行は event_date / team_name / grade_band が欠ける） */
export function parseMorningSlotForceChangedPayloadSummary(
  raw: unknown
): MorningSlotForceChangedPayloadSummary | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slotRaw = o.slot_code;
  const slot_code =
    slotRaw === null || slotRaw === undefined
      ? null
      : String(slotRaw).trim() || null;
  const morning_start_hm = String(o.morning_start_hm ?? "").trim();
  const morning_end_hm = String(o.morning_end_hm ?? "").trim();
  if (!morning_start_hm || !morning_end_hm) return null;

  const edRaw = o.event_date_iso;
  const event_date_iso =
    typeof edRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(edRaw.trim())
      ? edRaw.trim()
      : null;

  const teamRaw = o.team_name;
  const team_name =
    typeof teamRaw === "string" && teamRaw.trim() ? teamRaw.trim() : null;

  const gbRaw = o.grade_band;
  const grade_band =
    gbRaw === null || gbRaw === undefined
      ? null
      : String(gbRaw).trim() || null;

  return {
    slot_code,
    morning_start_hm,
    morning_end_hm,
    event_date_iso,
    team_name,
    grade_band,
  };
}

/**
 * 朝枠の強制変更後の案内メール。`notifications` は呼び出し側で pending 挿入済み想定。
 * 送信結果は `notificationId` の行のみ更新する（複数 pending 行があっても安全）。
 */
export async function sendMorningSlotForceChangedEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  notificationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  slotCode: string | null;
  morningStartHm: string;
  morningEndHm: string;
}): Promise<void> {
  const {
    supabase,
    notificationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    slotCode,
    morningStartHm,
    morningEndHm,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[morning slot force changed] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeLine = gradeBand?.trim() ? `学年帯\uFF1A${gradeBand.trim()}` : null;
  const slotLabel = slotCode?.trim() ? slotCode.trim() : "ご予約の朝の部の枠";
  const timeLine = `${morningStartHm}〜${morningEndHm}`;

  const contactUrl = reserveContactUrl();
  const contactText = contactUrl
    ? `ご不明な点がございましたら、お問い合わせページ（${contactUrl}）よりご連絡ください。`
    : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。";
  const contactHtml = contactUrl
    ? `<p>ご不明な点がございましたら、<a href="${escaped(contactUrl)}">お問い合わせページ</a>よりご連絡ください。</p>`
    : "<p>ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。</p>";

  const subject = `${MAIL_SUBJECT_BRAND_USER}朝の部の枠・時刻の変更のお知らせ`;

  const reservationLines = [
    `チーム名\uFF1A${teamName}`,
    `開催日\uFF1A${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    `対象\uFF1A${slotLabel}`,
    `変更後の時刻\uFF1A${timeLine}`,
  ];

  const text = [
    `${contactName} 様`,
    "",
    `${MAIL_BODY_SERVICE_NAME}をご利用いただきありがとうございます。`,
    "",
    "運営の都合により、ご予約の「朝の部」の枠の時刻が変更されました。",
    "お手数ですが、下記の内容をご確認ください。",
    "",
    "【ご予約内容・変更後の時刻】",
    ...reservationLines,
    "",
    "※ 午後の部のご予約内容に変更はありません。",
    "",
    contactText,
    "なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
    "",
    "よろしくお願いいたします。",
  ].join("\n");

  const reservationListHtml = reservationLines.map((l) => `<li>${escaped(l)}</li>`).join("");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(MAIL_BODY_SERVICE_NAME)}をご利用いただきありがとうございます。</p>
<p>運営の都合により、ご予約の<strong>朝の部</strong>の枠の時刻が変更されました。<br/>お手数ですが、下記をご確認ください。</p>
<p><strong>【ご予約内容・変更後の時刻】</strong></p>
<ul style="margin:8px 0;padding-left:1.25rem">${reservationListHtml}</ul>
<p style="font-size:14px;color:#52525b">※ 午後の部のご予約内容に変更はありません。</p>
${contactHtml}
<p>なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。</p>
<p>よろしくお願いいたします。</p>
</body></html>`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    });

    if (error) {
      const msg = truncateErrorMessage(
        typeof error.message === "string" ? error.message : String(error)
      );
      await supabase
        .from("notifications")
        .update({ status: "failed", error_message: msg })
        .eq("id", notificationId)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("id", notificationId)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("id", notificationId)
      .eq("status", "pending");
  }
}
