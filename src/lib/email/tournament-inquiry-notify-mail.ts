import "server-only";

import { Resend } from "resend";

import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { MAIL_SUBJECT_OPS_INQUIRY } from "@/lib/email/mail-brand";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 運営向け: 大会お問い合わせが届いた通知メール。
 * 宛先: TOURNAMENT_INQUIRY_NOTIFY_EMAIL → なければ OPS_NOTIFY_EMAIL（どちらも未設定なら送信しない）。
 */
export async function sendTournamentInquiryNotifyEmail(params: {
  inquiryId: string;
  createdAtIso: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const to =
    process.env.TOURNAMENT_INQUIRY_NOTIFY_EMAIL?.trim() ||
    process.env.OPS_NOTIFY_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();

  if (!to) {
    return {
      sent: false,
      skippedReason: "TOURNAMENT_INQUIRY_NOTIFY_EMAIL / OPS_NOTIFY_EMAIL unset",
    };
  }
  if (!apiKey || !from) {
    console.warn(
      "[tournament inquiry email] skipped: RESEND_API_KEY / RESEND_FROM"
    );
    return { sent: false, skippedReason: "resend not configured" };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const vercel = process.env.VERCEL_URL?.trim();
  const base =
    site ||
    (vercel ? `https://${vercel.replace(/\/$/, "")}` : "");
  const adminPath = `/admin/tournament-inquiries/${params.inquiryId}`;
  const adminUrl = base ? `${base}${adminPath}` : adminPath;

  const receivedJa = formatDateTimeTokyoWithWeekday(params.createdAtIso);
  const who = params.contactName.trim() || "（無記名）";
  const subject = `${MAIL_SUBJECT_OPS_INQUIRY}${who}より`;

  const textBody = [
    "公開サイトの「お問い合わせ」フォームから、次の内容が届きました。",
    "返信・対応は運営側でお願いします。",
    "",
    `受付日時: ${receivedJa}`,
    `お名前: ${params.contactName}`,
    `メール: ${params.contactEmail}`,
    `電話: ${params.contactPhone}`,
    "",
    "--- 内容 ---",
    params.message,
    "",
    `管理画面: ${adminUrl}`,
  ].join("\n");

  const htmlBody = `<p>公開サイトの「お問い合わせ」フォームから、次の内容が届きました。<br/>
返信・対応は運営側でお願いします。</p>
<p><strong>受付日時:</strong> ${escapeHtml(receivedJa)}<br/>
<strong>お名前:</strong> ${escapeHtml(params.contactName)}<br/>
<strong>メール:</strong> ${escapeHtml(params.contactEmail)}<br/>
<strong>電話:</strong> ${escapeHtml(params.contactPhone)}</p>
<p><strong>内容</strong></p>
<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(params.message)}</pre>
<p><a href="${escapeHtml(adminUrl)}">管理画面で開く</a></p>`;

  if (!SIMPLE_EMAIL_RE.test(to)) {
    return { sent: false, skippedReason: "invalid notify email address" };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: [to],
      subject,
      text: textBody,
      html: htmlBody,
    });
    return { sent: true };
  } catch (e) {
    console.warn("[tournament inquiry email] send failed", e);
    return { sent: false, skippedReason: "resend error" };
  }
}
