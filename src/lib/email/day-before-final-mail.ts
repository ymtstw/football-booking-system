import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { MAIL_BODY_SERVICE_NAME, MAIL_SUBJECT_BRAND_USER } from "@/lib/email/mail-brand";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_DAY_BEFORE_FINAL = "day_before_final";
export const TEMPLATE_WEATHER_CANCEL_IMMEDIATE = "weather_cancel_immediate";
export const TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE = "operational_cancel_immediate";
const ERROR_MESSAGE_MAX = 2000;

function truncateErrorMessage(msg: string): string {
  const t = msg.trim();
  if (t.length <= ERROR_MESSAGE_MAX) return t;
  return `${t.slice(0, ERROR_MESSAGE_MAX - 1)}…`;
}

function reserveContactPageUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/contact`;
}

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DayBeforeFinalVariant =
  | "held"
  | "weather_cancel"
  | "operational_cancel"
  | "pending_matching";

function subjectForDayBeforeFinal(variant: DayBeforeFinalVariant): string {
  if (variant === "weather_cancel" || variant === "operational_cancel") {
    return `${MAIL_SUBJECT_BRAND_USER}明日の開催について（中止）`;
  }
  if (variant === "pending_matching") {
    return `${MAIL_SUBJECT_BRAND_USER}明日の開催について（確認中）`;
  }
  return `${MAIL_SUBJECT_BRAND_USER}明日の開催について`;
}

function headlineForVariant(variant: DayBeforeFinalVariant): string {
  if (variant === "weather_cancel" || variant === "operational_cancel") {
    return "明日の開催は中止といたします。";
  }
  if (variant === "pending_matching") {
    return "現在、対戦スケジュールを確認しております。確認でき次第、あらためてご案内いたします。";
  }
  return "明日は予定どおり開催いたします。";
}

/**
 * JOB03: 開催前日 16:30 JST 想定バッチの「最終版」メール（開催確定 / 雨天中止 / 編成待ちを1テンプレートで出し分け）。
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
  /** 運営都合中止（`operational_cancel`）のとき、参加者向けに差し込む本文 */
  operationalCancellationNotice?: string | null;
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
    operationalCancellationNotice = null,
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
  const contactUrl = reserveContactPageUrl();

  const subject = subjectForDayBeforeFinal(variant);
  const headline = headlineForVariant(variant);
  const introLine = `${MAIL_BODY_SERVICE_NAME}について、明日のご案内です。`;

  const reservationSummaryLines = [
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
  ];

  const showSchedule = variant === "held";
  const scheduleBodyText =
    scheduleLines.length > 0
      ? scheduleLines.join("\n")
      : "（対戦スケジュールの行はまだありません。）";
  const scheduleBodyHtml =
    scheduleLines.length > 0
      ? scheduleLines.map((l) => `<p style="margin:6px 0">${escaped(l)}</p>`).join("")
      : `<p>（対戦スケジュールの行はまだありません。）</p>`;

  const cancelReasonHeading = "【中止理由・ご連絡事項】";
  const operationalNotice = operationalCancellationNotice?.trim() ?? "";
  const weatherNotesTrimmed = weatherNotes?.trim() ?? "";

  let noticeExtraText = "";
  let noticeHtmlBlock = "";
  if (variant === "operational_cancel" && operationalNotice) {
    noticeExtraText = `\n${cancelReasonHeading}\n${operationalNotice}`;
    noticeHtmlBlock = `<p style="margin-top:16px;font-size:15px"><strong>${escaped(cancelReasonHeading)}</strong></p><p style="white-space:pre-wrap">${escaped(operationalNotice)}</p>`;
  } else if (variant === "weather_cancel" && weatherNotesTrimmed) {
    noticeExtraText = `\n${cancelReasonHeading}\n${weatherNotesTrimmed}`;
    noticeHtmlBlock = `<p style="margin-top:16px;font-size:15px"><strong>${escaped(cancelReasonHeading)}</strong></p><p style="white-space:pre-wrap">${escaped(weatherNotesTrimmed)}</p>`;
  }

  const supplementHeld =
    "当日の対戦順や組み合わせは、チーム間で合意があれば調整いただいて構いません。";

  const footerHeldCancel = [
    contactUrl
      ? `ご不明な点がございましたら、サイトのお問い合わせページ（${contactUrl}）よりご連絡ください。`
      : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。",
    "なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
  ];

  const footerPending = [
    "お急ぎの場合は、サイトのお問い合わせページよりご連絡ください。",
    "",
    "なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
  ];

  const textParts: string[] = [`${contactName} 様`, "", introLine, "", headline, ""];

  if (variant === "held") {
    textParts.push(...reservationSummaryLines, "", "【対戦スケジュール】", scheduleBodyText, "", supplementHeld, "", ...footerHeldCancel);
  } else if (variant === "weather_cancel" || variant === "operational_cancel") {
    textParts.push(...reservationSummaryLines);
    if (noticeExtraText) textParts.push(noticeExtraText);
    textParts.push("", ...footerHeldCancel);
  } else {
    // pending_matching
    textParts.push(...reservationSummaryLines, "", ...footerPending);
  }

  const text = textParts.join("\n");

  const reservationListHtml = `<ul style="margin-top:8px;padding-left:1.25rem">
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>`;

  const scheduleSectionHtml = showSchedule
    ? `<p style="margin-top:16px;font-size:15px"><strong>【対戦スケジュール】</strong></p>${scheduleBodyHtml}<p style="margin-top:12px">${escaped(supplementHeld)}</p>`
    : "";

  const footerHeldCancelHtml = `<p style="margin-top:20px">${contactUrl ? `ご不明な点がございましたら、<a href="${escaped(contactUrl)}">お問い合わせページ</a>よりご連絡ください。` : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。"}</p>
<p>なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。</p>`;

  const footerPendingHtml = `<p style="margin-top:16px">${contactUrl ? `お急ぎの場合は、<a href="${escaped(contactUrl)}">お問い合わせページ</a>よりご連絡ください。` : "お急ぎの場合は、サイトのお問い合わせページよりご連絡ください。"}</p>
<p>なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。</p>`;

  const html =
    variant === "held"
      ? `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(introLine)}</p>
<p><strong>${escaped(headline)}</strong></p>
${reservationListHtml}
${scheduleSectionHtml}
${footerHeldCancelHtml}
</body></html>`
      : variant === "pending_matching"
        ? `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(introLine)}</p>
<p><strong>${escaped(headline)}</strong></p>
${reservationListHtml}
${footerPendingHtml}
</body></html>`
        : `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(introLine)}</p>
<p><strong>${escaped(headline)}</strong></p>
${reservationListHtml}
${noticeHtmlBlock}
${footerHeldCancelHtml}
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
 * 例外運用: 荒天などで中止を早く伝えるときの即時メール（標準は前日の一括バッチに含める）。
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
  const subject = `${MAIL_SUBJECT_BRAND_USER}雨天のため開催中止のお知らせ`;

  const text = [
    `${contactName} 様`,
    "",
    `「${MAIL_BODY_SERVICE_NAME}」のご予約について、緊急のご連絡です。`,
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
<p style="color:#52525b">「${escaped(MAIL_BODY_SERVICE_NAME)}」のご予約について、緊急のご連絡です。</p>
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

/**
 * 例外運用: 運営都合の中止を早く伝える即時メール（雨天即時とは別テンプレート）。
 */
export async function sendOperationalCancelImmediateEmailAndUpdateNotification(params: {
  supabase: SupabaseClient;
  reservationId: string;
  to: string;
  contactName: string;
  teamName: string;
  eventDateIso: string | null;
  gradeBand: string | null;
  operationalNotice: string;
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    operationalNotice,
  } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[operational cancel immediate] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面でご確認ください。";
  const gradeLine = gradeBand?.trim() ? `学年帯: ${gradeBand.trim()}` : null;
  const subject = `${MAIL_SUBJECT_BRAND_USER}運営都合により開催中止のお知らせ`;
  const body = operationalNotice.trim();

  const text = [
    `${contactName} 様`,
    "",
    `「${MAIL_BODY_SERVICE_NAME}」のご予約について、緊急のご連絡です。`,
    "",
    "運営の都合により、当該開催日は中止とします。至急のご連絡となり失礼します。",
    "",
    "▼ お知らせ（運営から）",
    body,
    "",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p style="color:#52525b">「${escaped(MAIL_BODY_SERVICE_NAME)}」のご予約について、緊急のご連絡です。</p>
<p>運営の都合により、当該開催日は<strong>中止</strong>とします。至急のご連絡となり失礼します。</p>
<p style="margin-top:12px;font-size:14px"><strong>お知らせ（運営から）</strong><br/>${escaped(body)}</p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>
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
        .eq("template_key", TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE)
        .eq("status", "pending");
      return;
    }

    await supabase
      .from("notifications")
      .update({ status: "sent", error_message: null })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE)
      .eq("status", "pending");
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await supabase
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_OPERATIONAL_CANCEL_IMMEDIATE)
      .eq("status", "pending");
  }
}
