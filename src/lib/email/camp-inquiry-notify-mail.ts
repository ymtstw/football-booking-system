import "server-only";

import { Resend } from "resend";

import { buildAdminCampInquiryDetailUrl } from "@/lib/camp-inquiry/camp-inquiry-admin-url";
import {
  CAMP_INQUIRY_SCHEMA_VERSION,
  formatCampInquiryAnswersForDisplay,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import { getLodgingPlanLabelJa } from "@/lib/camp-inquiry/camp-lodging-plans";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SIMPLE_EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 運営向け: 合宿相談が届いた通知メール。
 * CAMP_INQUIRY_NOTIFY_EMAIL が未設定のときは送信しない（DB 保存のみ）。
 */
export async function sendCampInquiryNotifyEmail(params: {
  inquiryId: string;
  createdAtIso: string;
  answers: Record<string, string>;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const to = process.env.CAMP_INQUIRY_NOTIFY_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();

  if (!to) {
    return { sent: false, skippedReason: "CAMP_INQUIRY_NOTIFY_EMAIL unset" };
  }
  if (!apiKey || !from) {
    console.warn("[camp inquiry email] skipped: RESEND_API_KEY / RESEND_FROM");
    return { sent: false, skippedReason: "resend not configured" };
  }

  const a = params.answers;
  const receivedJa = formatDateTimeTokyoWithWeekday(params.createdAtIso);
  const planLabel = a.preferred_plan
    ? getLodgingPlanLabelJa(a.preferred_plan) ?? a.preferred_plan
    : "";

  const structuredLines: [string, string][] = [
    ["受付日時", receivedJa],
    ["代表者名", a.contact_name ?? ""],
    ["所属チーム名", a.team_name ?? ""],
    ["メールアドレス", a.contact_email ?? ""],
    ["電話番号", a.contact_phone ?? ""],
    ["希望プラン", planLabel],
    ["希望日程", a.preferred_dates ?? ""],
    ["参加予定人数（概算）", a.headcount ?? ""],
    ["ご相談内容", a.inquiry_message ?? ""],
  ];

  const adminUrl = buildAdminCampInquiryDetailUrl(params.inquiryId);
  const extraLines = formatCampInquiryAnswersForDisplay(a).filter(
    (row) =>
      ![
        "代表者名",
        "所属チーム名",
        "メールアドレス",
        "電話番号",
        "希望プラン",
        "希望日程",
        "参加予定人数（概算）",
        "ご相談内容",
      ].includes(row.labelJa)
  );

  const textBody = [
    "合宿・宿泊の相談フォームから新着です（予約確定ではありません）。",
    "受付〜事前案内まで。当日運用・対戦表・在庫の自動管理は対象外です。",
    "",
    `照会 ID: ${params.inquiryId}`,
    `スキーマ: ${CAMP_INQUIRY_SCHEMA_VERSION}`,
    "",
    ...structuredLines.filter(([, v]) => v.trim() !== "").map(([k, v]) => `${k}: ${v}`),
    ...(extraLines.length > 0
      ? ["", "--- 任意項目・その他 ---", ...extraLines.map((l) => `${l.labelJa}: ${l.value}`)]
      : []),
    "",
    ...(adminUrl
      ? [`管理画面（詳細）: ${adminUrl}`]
      : ["管理画面: NEXT_PUBLIC_SITE_URL を設定すると詳細 URL をメールに記載できます。"]),
    "",
    "運用: このメールを起点に返信し、管理画面でステータスを更新してください。",
  ].join("\n");

  const structuredHtmlRows = structuredLines
    .filter(([, v]) => v.trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e4e4e7;vertical-align:top;font-weight:600;width:11rem">${escapeHtml(k)}</td><td style="padding:6px 10px;border:1px solid #e4e4e7;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const extraHtml =
    extraLines.length > 0
      ? `<p style="margin-top:12px;font-size:13px;font-weight:600">任意項目・その他</p><table style="border-collapse:collapse;font-size:14px;max-width:640px">${extraLines
          .map(
            (l) =>
              `<tr><td style="padding:6px 10px;border:1px solid #e4e4e7;font-weight:600">${escapeHtml(l.labelJa)}</td><td style="padding:6px 10px;border:1px solid #e4e4e7;white-space:pre-wrap">${escapeHtml(l.value)}</td></tr>`
          )
          .join("")}</table>`
      : "";

  const adminBlock = adminUrl
    ? `<p style="margin-top:14px"><a href="${escapeHtml(adminUrl)}">管理画面でこの受付を開く</a></p>`
    : "";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>合宿・宿泊の相談フォームから新着です（<strong>予約確定ではありません</strong>）。</p>
<p style="font-size:13px;color:#52525b">照会 ID: <code>${escapeHtml(params.inquiryId)}</code> / スキーマ: ${escapeHtml(CAMP_INQUIRY_SCHEMA_VERSION)}</p>
<table style="border-collapse:collapse;font-size:14px;max-width:640px">${structuredHtmlRows}</table>
${extraHtml}
${adminBlock}
<p style="font-size:12px;color:#71717a;margin-top:16px">返信は通常メールで。再通知機能は MVP ではありません。</p>
</body></html>`;

  const replyTo = a.contact_email?.trim();
  const replyToList =
    replyTo && SIMPLE_EMAIL_RE.test(replyTo) ? ([replyTo] as [string, ...string[]]) : undefined;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    ...(replyToList ? { replyTo: replyToList } : {}),
    subject: "【交流試合サイト】合宿・宿泊の相談が届きました",
    text: textBody,
    html,
  });

  if (error) {
    console.warn("[camp inquiry email] resend error:", error.message);
    return { sent: false, skippedReason: "resend error" };
  }

  return { sent: true };
}
