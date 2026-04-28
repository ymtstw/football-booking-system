import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { MAIL_BODY_SERVICE_NAME, MAIL_SUBJECT_BRAND_USER } from "@/lib/email/mail-brand";
import { formatReservationPublicRefForDisplay } from "@/lib/reservations/public-ref";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 利用者が Web からキャンセル完了したときの通知メール（送信失敗は握りつぶし） */
export async function sendReservationUserCancelledEmail(params: {
  to: string;
  contactName: string;
  teamName: string;
  publicRef: string | null;
  eventDateIso: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const to = params.to.trim();
  if (!apiKey || !from || !SIMPLE_EMAIL_RE.test(to)) {
    return;
  }

  const colon = "\uFF1A";
  const eventLine =
    params.eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(params.eventDateIso)
      ? formatIsoDateWithWeekdayJa(params.eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const refDisplay = formatReservationPublicRefForDisplay(params.publicRef);
  const refLine = refDisplay ? `予約番号${colon}${refDisplay}` : null;

  const subject = `${MAIL_SUBJECT_BRAND_USER}ご予約のキャンセルが完了しました`;
  const text = [
    `${params.contactName.trim()} 様`,
    "",
    `「${MAIL_BODY_SERVICE_NAME}」のご予約をキャンセルいたしました。`,
    "",
    `チーム名${colon}${params.teamName.trim()}`,
    `開催日${colon}${eventLine}`,
    ...(refLine ? [refLine, "お問い合わせの際は、上記の予約番号をお伝えください。", ""] : [""]),
    "内容に心当たりがない場合は、サイトのお問い合わせよりご連絡ください。",
    "",
    "よろしくお願いいたします。",
  ].join("\n");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(params.contactName.trim())} 様</p>
<p>「${escaped(MAIL_BODY_SERVICE_NAME)}」のご予約をキャンセルいたしました。</p>
<ul style="padding-left:1.25rem">
<li>チーム名${colon}${escaped(params.teamName.trim())}</li>
<li>開催日${colon}${escaped(eventLine)}</li>
${refLine ? `<li>${escaped(refLine)}</li><li>お問い合わせの際は、上記の予約番号をお伝えください。</li>` : ""}
</ul>
<p>内容に心当たりがない場合は、サイトのお問い合わせよりご連絡ください。</p>
<p>よろしくお願いいたします。</p>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to: [to], subject, text, html });
  } catch (e) {
    console.warn("[reservation user cancel mail] send failed", e);
  }
}
