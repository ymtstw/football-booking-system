import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { MAIL_BODY_SERVICE_NAME, MAIL_SUBJECT_BRAND_USER } from "@/lib/email/mail-brand";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_MINIMUM_CANCEL_NOTICE = "minimum_cancel_notice";

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

/**
 * 最少催行未達（締切時点で active チームが 2 以下）の即時連絡。
 */
export async function sendMinimumCancelNoticeEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[minimum cancel notice] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeBandTrimmed = gradeBand?.trim() ?? "";
  const subject = `${MAIL_SUBJECT_BRAND_USER}最少催行に満たず開催中止のお知らせ`;

  const text = [
    `${contactName} 様`,
    "",
    `「${MAIL_BODY_SERVICE_NAME}」をご利用いただきありがとうございます。`,
    "",
    "お申し込みいただいていた下記の開催日は、予約締切時点で参加チーム数が最少催行数に満たなかったため、開催中止となりました。",
    "",
    "【開催内容】",
    `チーム名：${teamName}`,
    `開催日：${eventLine}`,
    ...(gradeBandTrimmed ? [`学年帯：${gradeBandTrimmed}`] : []),
    "",
    "このたびはご希望に沿えず申し訳ございません。",
    "また別の開催日でのご参加をご検討いただけますと幸いです。",
    "",
    "なお、今回の予約についてお客様側でのお手続きは不要です。",
  ].join("\n");

  const gradeHtmlLine = gradeBandTrimmed
    ? `<p style="margin:0.25em 0">学年帯：${escaped(gradeBandTrimmed)}</p>`
    : "";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>「${escaped(MAIL_BODY_SERVICE_NAME)}」をご利用いただきありがとうございます。</p>
<p>お申し込みいただいていた下記の開催日は、予約締切時点で参加チーム数が<strong>最少催行数</strong>に満たなかったため、<strong>開催中止</strong>となりました。</p>
<p style="margin-bottom:0.35em"><strong>【開催内容】</strong></p>
<p style="margin:0.25em 0">チーム名：${escaped(teamName)}</p>
<p style="margin:0.25em 0">開催日：${escaped(eventLine)}</p>
${gradeHtmlLine}
<p>このたびはご希望に沿えず申し訳ございません。<br/>また別の開催日でのご参加をご検討いただけますと幸いです。</p>
<p>なお、今回の予約についてお客様側でのお手続きは不要です。</p>
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
        .eq("reservation_id", reservationId)
        .eq("template_key", TEMPLATE_MINIMUM_CANCEL_NOTICE)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_MINIMUM_CANCEL_NOTICE)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_MINIMUM_CANCEL_NOTICE)
      .eq("status", "pending");
  }
}
