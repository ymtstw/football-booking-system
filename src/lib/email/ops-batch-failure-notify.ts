import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";

/** 現場の運営アドレス未確定時のテスト用既定（`OPS_NOTIFY_EMAIL` で上書き可） */
export const DEFAULT_OPS_NOTIFY_EMAIL = "ymtstwdev@gmail.com";

function escaped(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 運営向けバッチ失敗通知の宛先（環境変数優先） */
export function resolveOpsNotifyEmail(): string {
  const fromEnv = process.env.OPS_NOTIFY_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_OPS_NOTIFY_EMAIL;
}

function siteBaseUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return base || null;
}

function adminNotificationsFailedUrl(): string | null {
  const base = siteBaseUrl();
  if (!base) return null;
  return `${base}/admin/notifications/failed`;
}

function adminEventDayNotificationsUrl(eventDayId: string): string | null {
  const base = siteBaseUrl();
  if (!base) return null;
  return `${base}/admin/event-days/${eventDayId}/notifications`;
}

export type OpsBatchFailureDigestInput = {
  /** 人が読むジョブ名（例: 前日最終通知） */
  jobLabelJa: string;
  /** DB の template_key（本文にそのまま記載、個人宛先は書かない） */
  templateKey: string;
  eventDayId: string;
  eventDateIso: string;
  gradeBand: string | null;
  failedCount: number;
  sentCount?: number;
  skippedCount?: number;
};

/**
 * 参加者向けバッチ送信で `failed > 0` のとき、運営宛に 1 通だけダイジェストを送る。
 * 利用者のメールアドレスは本文に含めない。
 */
export async function sendOpsBatchFailureDigestEmail(
  input: OpsBatchFailureDigestInput
): Promise<void> {
  const {
    jobLabelJa,
    templateKey,
    eventDayId,
    eventDateIso,
    gradeBand,
    failedCount,
    sentCount,
    skippedCount,
  } = input;

  if (failedCount <= 0) return;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[ops batch failure notify] skipped: RESEND_API_KEY / RESEND_FROM 未設定のため運営通知を送れません"
    );
    return;
  }

  const to = resolveOpsNotifyEmail();
  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : eventDateIso;
  const gradeLine = gradeBand?.trim() ? gradeBand.trim() : "（未設定）";

  const failedListUrl = adminNotificationsFailedUrl();
  const eventNotificationsUrl = adminEventDayNotificationsUrl(eventDayId);

  const countsLines: string[] = [
    `送信失敗件数: ${failedCount}`,
    ...(sentCount !== undefined ? [`送信成功件数: ${sentCount}`] : []),
    ...(skippedCount !== undefined ? [`スキップ件数: ${skippedCount}`] : []),
  ];

  const linkLines: string[] = [];
  if (failedListUrl) linkLines.push(`失敗一覧: ${failedListUrl}`);
  if (eventNotificationsUrl) linkLines.push(`当該開催日の通知: ${eventNotificationsUrl}`);

  const subject = `【交流試合・運営】メール送信失敗あり（${jobLabelJa}）`;

  const text = [
    "自動バッチで参加者向けメールの送信に失敗した予約があります。",
    "（本文に利用者のメールアドレスは含めていません）",
    "",
    `ジョブ: ${jobLabelJa}`,
    `テンプレート（template_key）: ${templateKey}`,
    `開催日 ID: ${eventDayId}`,
    `開催日: ${eventLine}`,
    `学年帯: ${gradeLine}`,
    "",
    ...countsLines,
    "",
    ...linkLines,
    "",
    "Resend のエラー解消・宛先修正後、管理画面の失敗一覧から再送できます。",
  ].join("\n");

  const linkHtml =
    failedListUrl || eventNotificationsUrl
      ? `<ul style="margin-top:8px">
${
  failedListUrl
    ? `<li><a href="${escaped(failedListUrl)}">メール送信失敗一覧</a></li>`
    : ""
}
${
  eventNotificationsUrl
    ? `<li><a href="${escaped(eventNotificationsUrl)}">当該開催日の通知</a></li>`
    : ""
}
</ul>`
      : "<p>サイト URL（NEXT_PUBLIC_SITE_URL）未設定のためリンクを省略しました。</p>";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>自動バッチで参加者向けメールの送信に<strong>失敗</strong>した予約があります。</p>
<p style="font-size:13px;color:#52525b">本文に利用者のメールアドレスは含めていません。</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#71717a">ジョブ</td><td>${escaped(jobLabelJa)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#71717a">template_key</td><td><code>${escaped(templateKey)}</code></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#71717a">開催日 ID</td><td><code>${escaped(eventDayId)}</code></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#71717a">開催日</td><td>${escaped(eventLine)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#71717a">学年帯</td><td>${escaped(gradeLine)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#71717a">失敗</td><td><strong>${failedCount}</strong> 件</td></tr>
${
  sentCount !== undefined
    ? `<tr><td style="padding:4px 12px 4px 0;color:#71717a">成功</td><td>${sentCount} 件</td></tr>`
    : ""
}
${
  skippedCount !== undefined
    ? `<tr><td style="padding:4px 12px 4px 0;color:#71717a">スキップ</td><td>${skippedCount} 件</td></tr>`
    : ""
}
</table>
${linkHtml}
<p style="margin-top:16px;font-size:13px;color:#52525b">Resend のエラー解消・宛先修正後、管理画面から再送できます。</p>
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
      console.error(
        "[ops batch failure notify] Resend error:",
        typeof error.message === "string" ? error.message : String(error)
      );
    }
  } catch (e) {
    console.error(
      "[ops batch failure notify] send failed:",
      e instanceof Error ? e.message : "unknown"
    );
  }
}
