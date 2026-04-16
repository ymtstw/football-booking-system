import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_MATCHING_PROPOSAL = "matching_proposal";

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
 * 締切翌（開催 2 日前）16:30 のマッチング案内（運営確認前提の暫定案内）。
 */
export async function sendMatchingProposalEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  scheduleLines: string[];
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    scheduleLines,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[matching proposal] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeLine = gradeBand?.trim() ? `学年帯: ${gradeBand.trim()}` : null;
  const subject = "【交流試合】マッチング案内（確認中・変更の可能性あり）";

  const scheduleBlock =
    scheduleLines.length > 0
      ? scheduleLines.map((l) => `・${l}`).join("\n")
      : "・（対戦・枠の行はまだありません。管理側で調整中の場合があります）";

  const text = [
    `${contactName} 様`,
    "",
    "自動編成に基づくマッチング案をお知らせします。開催前日 17:00 に最終案内を送るまで、運営側で内容を確認・微修正する場合があります。",
    "",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    "",
    "▼ 現在の対戦・枠（案）",
    scheduleBlock,
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");

  const scheduleHtml =
    scheduleLines.length > 0
      ? `<ul>${scheduleLines.map((l) => `<li>${escaped(l)}</li>`).join("")}</ul>`
      : "<p>（対戦・枠の行はまだありません）</p>";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>自動編成に基づく<strong>マッチング案</strong>です。開催前日 17:00 の最終案内まで、運営で変更がある場合があります。</p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>
<p><strong>現在の対戦・枠（案）</strong></p>
${scheduleHtml}
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
        .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_MATCHING_PROPOSAL)
      .eq("status", "pending");
  }
}
