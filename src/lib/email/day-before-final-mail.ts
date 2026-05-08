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

function smartParkIosUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SMARTPARK_IOS_URL?.trim() ||
    "https://apps.apple.com/jp/app/id1525506836"
  );
}

function smartParkAndroidUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SMARTPARK_ANDROID_URL?.trim() ||
    "https://play.google.com/store/apps/details?id=jp.smartpark.app.smapa"
  );
}

function buildParkingNoticeTextLines(): string[] {
  const iosUrl = smartParkIosUrl();
  const androidUrl = smartParkAndroidUrl();
  return [
    "【駐車場をご利用の方へ】",
    "",
    "駐車料金のお支払いは、SmartParkアプリでの決済のみとなります。",
    "現地での現金精算はできません。",
    "",
    "当日スムーズにご利用いただくため、事前にSmartParkアプリのインストールをお願いいたします。",
    "",
    "アプリのダウンロードはこちら",
    `iPhoneをご利用の方：${iosUrl}`,
    `Androidをご利用の方：${androidUrl}`,
    "",
    "当日は、現地の案内に沿ってSmartParkアプリを操作し、駐車料金をお支払いください。",
    "当日スムーズにご利用いただくため、駐車場をご利用される保護者・関係者の方にも、事前に本内容をご周知ください。",
  ];
}

function buildParkingNoticeHtml(): string {
  const iosUrl = smartParkIosUrl();
  const androidUrl = smartParkAndroidUrl();
  return `<p style="margin-top:20px;font-size:15px"><strong>【駐車場をご利用の方へ】</strong></p>
<p style="margin-top:10px"><strong>駐車料金のお支払いは、SmartParkアプリでの決済のみとなります。</strong><br/>
<strong>現地での現金精算はできません。</strong></p>
<p>当日スムーズにご利用いただくため、事前にSmartParkアプリのインストールをお願いいたします。</p>
<p style="margin-top:10px"><strong>アプリのダウンロードはこちら</strong><br/>
iPhoneをご利用の方：<a href="${escaped(iosUrl)}">${escaped(iosUrl)}</a><br/>
Androidをご利用の方：<a href="${escaped(androidUrl)}">${escaped(androidUrl)}</a></p>
<p>当日は、現地の案内に沿ってSmartParkアプリを操作し、駐車料金をお支払いください。</p>
<p>当日スムーズにご利用いただくため、駐車場をご利用される保護者・関係者の方にも、事前に本内容をご周知ください。</p>`;
}

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 本文ラベルは全角コロンで統一（ユーザー向け文言と揃える） */
const BODY_COLON = "\uFF1A";

/** 雨天中止メール共通の件名 */
const SUBJECT_WEATHER_CANCEL = `${MAIL_SUBJECT_BRAND_USER}雨天中止のお知らせ`;

function gradeBandDisplayOrDash(gradeBand: string | null): string {
  const t = gradeBand?.trim();
  return t ? t : "—";
}

/**
 * 送信専用・お問い合わせ・結び（雨天中止／開催確定など参加者向け通知で統一）
 */
function standardTransactionalFooterTextLines(contactUrl: string | null): string[] {
  const inquiry = contactUrl
    ? [
        "ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。",
        contactUrl,
      ].join("\n")
    : "ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。";
  return [
    "こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
    inquiry,
    "",
    "よろしくお願いいたします。",
  ];
}

function standardTransactionalFooterHtml(contactUrl: string | null): string {
  const inquiry = contactUrl
    ? `<p>ご不明な点がございましたら、<a href="${escaped(contactUrl)}">お問い合わせフォーム</a>よりご連絡ください。</p>`
    : `<p>ご不明な点がございましたら、お問い合わせフォームよりご連絡ください。</p>`;
  return `<p style="margin-top:20px">こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。</p>
${inquiry}
<p>よろしくお願いいたします。</p>`;
}

/** 雨天中止（即時・前日バッチ共通）の本文・件名 */
function buildRainWeatherCancelEmail(params: {
  teamName: string;
  eventLine: string;
  gradeBandDisplay: string;
  contactUrl: string | null;
  /** 管理画面メモ（任意）。「ご了承ください」の直後〜フッター直前に差し込む */
  participantMemo?: string | null;
}): { subject: string; text: string; html: string } {
  const { teamName, eventLine, gradeBandDisplay, contactUrl, participantMemo } = params;
  const memoTrim = participantMemo?.trim() ?? "";

  const midBodyText = memoTrim
    ? ["ご予定いただいていたところ恐れ入りますが、ご了承ください。", "", memoTrim]
    : ["ご予定いただいていたところ恐れ入りますが、ご了承ください。"];

  const text = [
    `${teamName} 様`,
    "",
    "このたびはお申し込みいただきありがとうございます。",
    "",
    "雨天のため、下記の開催日は中止となります。",
    "",
    `・チーム名${BODY_COLON}${teamName}`,
    `・開催日${BODY_COLON}${eventLine}`,
    `・学年帯${BODY_COLON}${gradeBandDisplay}`,
    "",
    ...midBodyText,
    "",
    ...standardTransactionalFooterTextLines(contactUrl),
  ].join("\n");

  const memoHtml = memoTrim
    ? `<p style="margin-top:14px;white-space:pre-wrap">${escaped(memoTrim)}</p>`
    : "";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(teamName)} 様</p>
<p>このたびはお申し込みいただきありがとうございます。</p>
<p>雨天のため、下記の開催日は<strong>中止</strong>となります。</p>
<p style="margin-top:14px;line-height:1.75">・チーム名${BODY_COLON}${escaped(teamName)}<br/>
・開催日${BODY_COLON}${escaped(eventLine)}<br/>
・学年帯${BODY_COLON}${escaped(gradeBandDisplay)}</p>
<p>ご予定いただいていたところ恐れ入りますが、ご了承ください。</p>
${memoHtml}
${standardTransactionalFooterHtml(contactUrl)}
</body></html>`;

  return { subject: SUBJECT_WEATHER_CANCEL, text, html };
}

export type DayBeforeFinalVariant =
  | "held"
  | "weather_cancel"
  | "operational_cancel"
  | "pending_matching";

function subjectForDayBeforeFinal(variant: DayBeforeFinalVariant): string {
  if (variant === "operational_cancel") {
    return `${MAIL_SUBJECT_BRAND_USER}明日の開催について（中止）`;
  }
  if (variant === "pending_matching") {
    return `${MAIL_SUBJECT_BRAND_USER}明日の開催について（確認中）`;
  }
  return `${MAIL_SUBJECT_BRAND_USER}明日の開催について`;
}

function headlineForVariant(variant: DayBeforeFinalVariant): string {
  if (variant === "operational_cancel") {
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
  const gradeBandDisplay = gradeBandDisplayOrDash(gradeBand);
  const gradeLine = gradeBand?.trim() ? `学年帯: ${gradeBand.trim()}` : null;
  const contactUrl = reserveContactPageUrl();

  let subject: string;
  let text: string;
  let html: string;

  if (variant === "weather_cancel") {
    const built = buildRainWeatherCancelEmail({
      teamName,
      eventLine,
      gradeBandDisplay,
      contactUrl,
      participantMemo: weatherNotes,
    });
    subject = built.subject;
    text = built.text;
    html = built.html;
  } else {
    subject = subjectForDayBeforeFinal(variant);
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

    let noticeExtraText = "";
    let noticeHtmlBlock = "";
    if (variant === "operational_cancel" && operationalNotice) {
      noticeExtraText = `\n${cancelReasonHeading}\n${operationalNotice}`;
      noticeHtmlBlock = `<p style="margin-top:16px;font-size:15px"><strong>${escaped(cancelReasonHeading)}</strong></p><p style="white-space:pre-wrap">${escaped(operationalNotice)}</p>`;
    }

    const supplementHeld =
      "当日の対戦順や組み合わせは、チーム間で合意があれば調整いただいて構いません。";

    const footerStandardLines = standardTransactionalFooterTextLines(contactUrl);
    const parkingLines = variant === "held" ? buildParkingNoticeTextLines() : [];

    const footerPendingLines = [
      ...(contactUrl
        ? ["お急ぎの場合は、お問い合わせフォームよりご連絡ください。", contactUrl, ""]
        : ["お急ぎの場合は、お問い合わせフォームよりご連絡ください。", ""]),
      ...footerStandardLines,
    ];

    const textParts: string[] = [`${contactName} 様`, "", introLine, "", headline, ""];

    if (variant === "held") {
      textParts.push(
        ...reservationSummaryLines,
        "",
        "【対戦スケジュール】",
        scheduleBodyText,
        "",
        supplementHeld,
        "",
        ...parkingLines,
        "",
        ...footerStandardLines
      );
    } else if (variant === "operational_cancel") {
      textParts.push(...reservationSummaryLines);
      if (noticeExtraText) textParts.push(noticeExtraText);
      textParts.push("", ...footerStandardLines);
    } else {
      textParts.push(...reservationSummaryLines, "", ...footerPendingLines);
    }

    text = textParts.join("\n");

    const reservationListHtml = `<ul style="margin-top:8px;padding-left:1.25rem">
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${gradeLine ? `<li>${escaped(gradeLine)}</li>` : ""}
</ul>`;

    const scheduleSectionHtml = showSchedule
      ? `<p style="margin-top:16px;font-size:15px"><strong>【対戦スケジュール】</strong></p>${scheduleBodyHtml}<p style="margin-top:12px">${escaped(supplementHeld)}</p>`
      : "";
    const parkingHtml = variant === "held" ? buildParkingNoticeHtml() : "";

    const footerStandardHtml = standardTransactionalFooterHtml(contactUrl);

    const footerPendingHtml = `<p style="margin-top:16px">${contactUrl ? `お急ぎの場合は、<a href="${escaped(contactUrl)}">お問い合わせフォーム</a>よりご連絡ください。` : "お急ぎの場合は、お問い合わせフォームよりご連絡ください。"}</p>
${footerStandardHtml}`;

    html =
      variant === "held"
        ? `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>${escaped(introLine)}</p>
<p><strong>${escaped(headline)}</strong></p>
${reservationListHtml}
${scheduleSectionHtml}
${parkingHtml}
${footerStandardHtml}
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
${footerStandardHtml}
</body></html>`;
  }

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
  const contactUrl = reserveContactPageUrl();
  const gradeBandDisplay = gradeBandDisplayOrDash(gradeBand);

  const { subject, text, html } = buildRainWeatherCancelEmail({
    teamName,
    eventLine,
    gradeBandDisplay,
    contactUrl,
    participantMemo: weatherNotes,
  });

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
  const gradeBandDisplay = gradeBandDisplayOrDash(gradeBand);
  const contactUrl = reserveContactPageUrl();
  const subject = `${MAIL_SUBJECT_BRAND_USER}運営都合により開催中止のお知らせ`;
  const noticeBlock = operationalNotice.trim();
  const noticeHeading = "【お知らせ】";
  const cancelReasonHeading = "【中止理由・ご連絡事項】";

  const text = [
    `${contactName} 様`,
    "",
    "運営上の都合により、下記の開催日は中止となります。",
    "",
    `・チーム名${BODY_COLON}${teamName}`,
    `・開催日${BODY_COLON}${eventLine}`,
    `・学年帯${BODY_COLON}${gradeBandDisplay}`,
    "",
    noticeHeading,
    noticeBlock,
    "",
    cancelReasonHeading,
    noticeBlock,
    "",
    ...standardTransactionalFooterTextLines(contactUrl),
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");

  const footerHtml = standardTransactionalFooterHtml(contactUrl);

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>運営上の都合により、下記の開催日は<strong>中止</strong>となります。</p>
<ul style="margin-top:12px;padding-left:1.25rem;line-height:1.75">
<li>チーム名${BODY_COLON}${escaped(teamName)}</li>
<li>開催日${BODY_COLON}${escaped(eventLine)}</li>
<li>学年帯${BODY_COLON}${escaped(gradeBandDisplay)}</li>
</ul>
<p style="margin-top:16px;font-size:15px"><strong>${escaped(noticeHeading)}</strong></p>
<p style="white-space:pre-wrap">${escaped(noticeBlock)}</p>
<p style="margin-top:16px;font-size:15px"><strong>${escaped(cancelReasonHeading)}</strong></p>
<p style="white-space:pre-wrap">${escaped(noticeBlock)}</p>
${footerHtml}
<p style="margin-top:16px;font-size:12px;color:#71717a">本メールに心当たりがない場合は破棄してください。</p>
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
