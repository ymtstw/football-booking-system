import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_DAY_BEFORE_FINAL = "day_before_final";
const TEMPLATE_WEATHER_CANCEL_IMMEDIATE = "weather_cancel_immediate";
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

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DayBeforeFinalVariant = "held" | "weather_cancel" | "pending_matching";

function subjectForDayBeforeFinal(variant: DayBeforeFinalVariant): string {
  if (variant === "weather_cancel") {
    return "【交流試合】前日のご連絡（雨天中止・最終案内）";
  }
  if (variant === "pending_matching") {
    return "【交流試合】前日のご連絡（編成確定前・ご確認ください）";
  }
  return "【交流試合】前日のご連絡（開催確定・最終案内）";
}

function headlineForVariant(variant: DayBeforeFinalVariant): string {
  if (variant === "weather_cancel") {
    return "雨天のため、当該開催日は中止とします（最終案内）。";
  }
  if (variant === "pending_matching") {
    return "締切後の自動編成がまだ完了していないか、管理側で確認中です。対戦表は追ってご連絡するか、管理窓口までお問い合わせください。";
  }
  return "開催を確定し、前日時点の対戦予定をお知らせします。";
}

/**
 * JOB03: 前日 13:30 の「最終版」メール（開催確定 / 雨天中止 / 編成待ちを1テンプレートで出し分け）。
 */
export async function sendDayBeforeFinalEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  variant: DayBeforeFinalVariant;
  weatherNotes: string | null;
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
    variant,
    weatherNotes,
    scheduleLines,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[day-before final email] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeLine = gradeBand?.trim() ? `学年帯: ${gradeBand.trim()}` : null;
  const manageUrl = managePageUrl();
  const manageLine = manageUrl
    ? `予約の確認: ${manageUrl}`
    : "サイトの「予約確認・キャンセル」から操作できます。";

  const subject = subjectForDayBeforeFinal(variant);
  const headline = headlineForVariant(variant);
  const scheduleBlock =
    scheduleLines.length > 0
      ? scheduleLines.map((l) => `・${l}`).join("\n")
      : "・（対戦・枠の行はありません）";

  const weatherExtra =
    weatherNotes?.trim() && variant !== "pending_matching"
      ? `\n\n【管理者メモ（天候・連絡事項）】\n${weatherNotes.trim()}`
      : "";

  const text = [
    `${contactName} 様`,
    "",
    headline,
    "",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    "",
    "▼ 前日時点の対戦・枠（参考）",
    scheduleBlock,
    weatherExtra,
    "",
    manageLine,
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");

  const scheduleHtml =
    scheduleLines.length > 0
      ? `<ul>${scheduleLines.map((l) => `<li>${escaped(l)}</li>`).join("")}</ul>`
      : "<p>（対戦・枠の行はありません）</p>";

  const weatherHtml =
    weatherNotes?.trim() && variant !== "pending_matching"
      ? `<p style="margin-top:12px;font-size:13px;color:#52525b"><strong>管理者メモ（天候・連絡事項）</strong><br/>${escaped(weatherNotes.trim())}</p>`
      : "";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>${escaped(headline)}</p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>
<p><strong>前日時点の対戦・枠（参考）</strong></p>
${scheduleHtml}
${weatherHtml}
<p style="margin-top:16px">${manageUrl ? `<a href="${escaped(manageUrl)}">予約の確認ページを開く</a>` : escaped(manageLine)}</p>
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
        .eq("template_key", TEMPLATE_DAY_BEFORE_FINAL)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_DAY_BEFORE_FINAL)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_DAY_BEFORE_FINAL)
      .eq("status", "pending");
  }
}

/**
 * 例外運用: 荒天などで中止を早く伝えるときの即時メール（標準は前日 13:30 一括に含める）。
 */
export async function sendWeatherCancelImmediateEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  weatherNotes: string | null;
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    weatherNotes,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[weather cancel immediate] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeLine = gradeBand?.trim() ? `学年帯: ${gradeBand.trim()}` : null;
  const subject = "【交流試合】雨天（天候）により開催中止のお知らせ";

  const text = [
    `${contactName} 様`,
    "",
    "雨天（天候）のため、当該開催日は中止とします。至急のご連絡となり失礼します。",
    "",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    ...(weatherNotes?.trim() ? ["", `連絡事項: ${weatherNotes.trim()}`] : []),
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>雨天（天候）のため、当該開催日は<strong>中止</strong>とします。至急のご連絡となり失礼します。</p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>
${weatherNotes?.trim() ? `<p style="font-size:14px">${escaped(weatherNotes.trim())}</p>` : ""}
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
        .eq("template_key", TEMPLATE_WEATHER_CANCEL_IMMEDIATE)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_WEATHER_CANCEL_IMMEDIATE)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_WEATHER_CANCEL_IMMEDIATE)
      .eq("status", "pending");
  }
}
