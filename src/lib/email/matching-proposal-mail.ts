import "server-only";

import { Resend } from "resend";

import type { ReservationScheduleRow } from "@/lib/day-before/reservation-schedule-lines";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { MAIL_BODY_SERVICE_NAME, MAIL_SUBJECT_BRAND_USER } from "@/lib/email/mail-brand";
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

function formatGradeBandForMail(gradeBand: string | null): string | null {
  const g = gradeBand?.trim();
  if (!g) return null;
  if (g === "1-2" || g === "3-4" || g === "5-6") return `${g}年`;
  if (/^\d+-\d+$/.test(g)) return `${g}年`;
  return g;
}

function reserveContactUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/contact`;
}

function rowsToPlainSchedule(rows: ReservationScheduleRow[]): string {
  if (rows.length === 0) {
    return "（対戦スケジュールの行はまだありません。運営で調整中の場合があります）";
  }
  return rows
    .map((r) => {
      const refPart = r.referee ? `／審判：${r.referee}` : "";
      return `${r.startHm}〜${r.endHm}　${r.teamA} vs ${r.teamB}${refPart}`;
    })
    .join("\n");
}

function rowsToScheduleTableHtml(rows: ReservationScheduleRow[]): string {
  if (rows.length === 0) {
    return "<p>（対戦スケジュールの行はまだありません。運営で調整中の場合があります）</p>";
  }
  const head =
    '<thead><tr style="background:#f4f4f5;border-bottom:2px solid #e4e4e7">' +
    '<th style="text-align:left;padding:10px 12px;border:1px solid #e4e4e7;font-size:13px">時間</th>' +
    '<th style="text-align:left;padding:10px 12px;border:1px solid #e4e4e7;font-size:13px">対戦</th>' +
    '<th style="text-align:left;padding:10px 12px;border:1px solid #e4e4e7;font-size:13px">審判</th>' +
    "</tr></thead>";
  const bodyRows = rows
    .map((r) => {
      const timeCell = `${escaped(r.startHm)}〜${escaped(r.endHm)}`;
      const vsCell = `${escaped(r.teamA)} vs ${escaped(r.teamB)}`;
      const refCell = r.referee ? escaped(r.referee) : "—";
      return (
        "<tr>" +
        `<td style="padding:10px 12px;border:1px solid #e4e4e7;vertical-align:top">${timeCell}</td>` +
        `<td style="padding:10px 12px;border:1px solid #e4e4e7;vertical-align:top">${vsCell}</td>` +
        `<td style="padding:10px 12px;border:1px solid #e4e4e7;vertical-align:top">${refCell}</td>` +
        "</tr>"
      );
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;max-width:640px;font-size:14px;margin-top:8px">${head}<tbody>${bodyRows}</tbody></table>`;
}

/**
 * 締切翌（開催 2 日前）16:00 JST 想定バッチのマッチング案内（運営確認前提の暫定案内）。
 */
export async function sendMatchingProposalEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  scheduleRows: ReservationScheduleRow[];
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    scheduleRows,
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
  const gradeFormatted = formatGradeBandForMail(gradeBand);
  const subject = `${MAIL_SUBJECT_BRAND_USER}対戦スケジュールのご案内`;

  const schedulePlain = rowsToPlainSchedule(scheduleRows);
  const contactUrl = reserveContactUrl();
  const contactText = contactUrl
    ? `ご不明な点がございましたら、お問い合わせページ（${contactUrl}）よりご連絡ください。`
    : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。";
  const contactHtml = contactUrl
    ? `<p>ご不明な点がございましたら、<a href="${escaped(contactUrl)}">お問い合わせページ</a>よりご連絡ください。</p>`
    : "<p>ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。</p>";

  const reservationLines = [
    `チーム名\uFF1A${teamName}`,
    `開催日\uFF1A${eventLine}`,
    ...(gradeFormatted ? [`学年帯\uFF1A${gradeFormatted}`] : []),
  ];

  const text = [
    `${contactName} 様`,
    "",
    `${MAIL_BODY_SERVICE_NAME}の対戦スケジュールをご案内いたします。`,
    "",
    "本スケジュールは、締切後の自動編成に基づいて作成しています。",
    "当日の対戦順や組み合わせは、チーム間で合意があれば調整いただいて問題ありません。",
    "なお、開催可否については、天候状況を踏まえたうえで、開催前日18:00頃に最終案内をお送りします。",
    "",
    "【ご予約内容】",
    ...reservationLines,
    "",
    "【対戦スケジュール】",
    schedulePlain,
    "",
    contactText,
    "なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
    "",
    "よろしくお願いいたします。",
  ].join("\n");

  const reservationListHtml = reservationLines.map((l) => `<li>${escaped(l)}</li>`).join("");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(MAIL_BODY_SERVICE_NAME)}の対戦スケジュールをご案内いたします。</p>
<p>本スケジュールは、締切後の自動編成に基づいて作成しています。<br/>
当日の対戦順や組み合わせは、チーム間で合意があれば調整いただいて問題ありません。<br/>
なお、開催可否については、天候状況を踏まえたうえで、開催前日18:00頃に最終案内をお送りします。</p>
<p><strong>【ご予約内容】</strong></p>
<ul style="margin:8px 0;padding-left:1.25rem">${reservationListHtml}</ul>
<p><strong>【対戦スケジュール】</strong></p>
${rowsToScheduleTableHtml(scheduleRows)}
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
