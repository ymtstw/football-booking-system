import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_KEY = "reservation_created";
const ERROR_MESSAGE_MAX = 2000;

function truncateErrorMessage(msg: string): string {
  const t = msg.trim();
  if (t.length <= ERROR_MESSAGE_MAX) return t;
  return `${t.slice(0, ERROR_MESSAGE_MAX - 1)}…`;
}

function managePageUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/manage`;
}

/**
 * 予約完了メール（確認コード同封）を Resend で送り、notifications を sent / failed に更新する。
 * RESEND_API_KEY または RESEND_FROM が無い場合は送信をスキップし、notifications は pending のままにする。
 */
export async function sendReservationCreatedEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  reservationTokenPlain: string;
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    reservationTokenPlain,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[reservation email] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面の開催日一覧でご確認ください。";
  const gradeLine = gradeBand?.trim()
    ? `学年帯: ${gradeBand.trim()}`
    : null;
  const manageUrl = managePageUrl();
  const manageLine = manageUrl
    ? `予約の確認・変更（締切前）・キャンセル（締切前）:\n${manageUrl}`
    : "予約の確認・変更は、サイトの「予約確認・キャンセル」から行えます。";

  const subject = "【交流試合】予約が完了しました（確認コードをご確認ください）";

  const text = [
    `${contactName} 様`,
    "",
    "このたびはお申し込みありがとうございます。予約が完了しました。",
    "",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    "",
    "▼ 予約確認コード（厳重に保管してください）",
    "第三者に見せると、予約の確認や操作ができる可能性があります。",
    "",
    reservationTokenPlain,
    "",
    manageLine,
    "",
    "本メールに心当たりがない場合は、お手数ですが破棄してください。",
  ].join("\n");

  const escaped = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const tokenHtml = `<pre style="font-size:12px;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px;border:1px solid #e4e4e7">${escaped(reservationTokenPlain)}</pre>`;
  const manageHtml = manageUrl
    ? `<p><a href="${escaped(manageUrl)}">予約の確認・キャンセルページを開く</a></p>`
    : `<p>サイトの「予約確認・キャンセル」から操作できます。</p>`;

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>このたびはお申し込みありがとうございます。予約が完了しました。</p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${
  gradeBand?.trim()
    ? `<li>学年帯: ${escaped(gradeBand.trim())}</li>`
    : ""
}
</ul>
<p><strong>予約確認コード</strong>（厳重に保管してください。第三者に共有しないでください。）</p>
${tokenHtml}
${manageHtml}
<p style="font-size:12px;color:#71717a">本メールに心当たりがない場合は破棄してください。</p>
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
        .eq("template_key", TEMPLATE_KEY)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_KEY)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_KEY)
      .eq("status", "pending");
  }
}
