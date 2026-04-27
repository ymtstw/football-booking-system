import "server-only";

import { Resend } from "resend";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import {
  MAIL_BODY_SERVICE_NAME,
  MAIL_SUBJECT_BRAND_USER,
  MAIL_SUBJECT_OPS_SYSTEM,
} from "@/lib/email/mail-brand";
import { resolveOpsNotifyEmail } from "@/lib/email/ops-batch-failure-notify";
import { gradeYearLabelJa } from "@/lib/reservations/grade-year";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import {
  dispatchReservationCreatedMailDeliveryEvent,
  type ReservationCreatedMailDeliveryTrigger,
} from "@/lib/integrations/reservation-created-mail-delivery";
import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_KEY = "reservation_created";
const ERROR_MESSAGE_MAX = 2000;
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** メール用: 確認コード付きで予約内容画面へ（token は正規化済み平文） */
function manageViewUrlWithToken(tokenPlain: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/manage/view?token=${encodeURIComponent(tokenPlain)}`;
}

function reserveContactPageUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reserve/contact`;
}

function escapeHtmlLite(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 予約完了メールが利用者宛に送れなかったとき、運営宛（OPS_NOTIFY_EMAIL）に 1 通。
 * テスト用 Resend では利用者宛が拒否されても、運営メールなら同一キーで届くことが多い。
 * 確認コードは含めない。
 */
async function notifyOpsReservationCreatedDeliveryFailed(params: {
  reservationId: string;
  teamName: string;
  intendedTo: string;
  resendError: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const to = resolveOpsNotifyEmail().trim();
  if (!apiKey || !from || !to || !SIMPLE_EMAIL_RE.test(to)) {
    return;
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const adminResUrl = base
    ? `${base}/admin/reservations/${params.reservationId}`
    : `(管理) /admin/reservations/${params.reservationId}`;
  const failedListUrl = base
    ? `${base}/admin/notifications/failed?status=failed`
    : "/admin/notifications/failed?status=failed";

  const subject = `${MAIL_SUBJECT_OPS_SYSTEM}予約完了メール送信失敗`;
  const errShort = truncateErrorMessage(params.resendError);
  const text = [
    "参加者向け「予約完了メール」の送信が Resend で失敗し、notifications を failed に更新しました。",
    "",
    `予約ID: ${params.reservationId}`,
    `チーム名: ${params.teamName}`,
    `失敗した宛先（代表メール）: ${params.intendedTo}`,
    "",
    "Resend のエラー:",
    errShort,
    "",
    "次の確認: 宛先の誤記、Resend のドメイン検証・テストモードの宛先制限など。",
    `予約の管理: ${adminResUrl}`,
    `メール送信履歴（失敗タブ）: ${failedListUrl}`,
    "",
    "（確認コードはこの通知には含めていません）",
  ].join("\n");

  const adminHref = base
    ? `${base}/admin/reservations/${params.reservationId}`
    : "";
  const failedHref = base ? `${base}/admin/notifications/failed?status=failed` : "";
  const adminFailedLinksHtml =
    adminHref && failedHref
      ? `<p><a href="${escapeHtmlLite(adminHref)}">予約を管理画面で開く</a> · <a href="${escapeHtmlLite(failedHref)}">メール送信履歴（失敗タブ）</a></p>`
      : `<p>管理画面パス: <code>${escapeHtmlLite(`/admin/reservations/${params.reservationId}`)}</code> / <code>/admin/notifications/failed?status=failed</code>（<code>NEXT_PUBLIC_SITE_URL</code> 未設定時はリンク省略）</p>`;

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>参加者向け「予約完了メール」の送信が Resend で失敗し、<code>notifications</code> を <strong>failed</strong> に更新しました。</p>
<ul>
<li><strong>予約ID:</strong> ${escapeHtmlLite(params.reservationId)}</li>
<li><strong>チーム名:</strong> ${escapeHtmlLite(params.teamName)}</li>
<li><strong>失敗した宛先（代表メール）:</strong> ${escapeHtmlLite(params.intendedTo)}</li>
</ul>
<p><strong>Resend のエラー</strong></p>
<pre style="white-space:pre-wrap;font-size:12px;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtmlLite(errShort)}</pre>
${adminFailedLinksHtml}
<p style="font-size:12px;color:#71717a">確認コードはこの通知には含めていません。</p>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    });
    if (error) {
      console.warn(
        "[reservation email] ops failure notify resend error:",
        error.message
      );
    }
  } catch (e) {
    console.warn("[reservation email] ops failure notify exception", e);
  }
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
  /** 予約時に選択した代表学年（1〜6） */
  representativeGradeYear: number;
  /** 確認コード正規形（ハイフンなし）。リンク・ハッシュと一致 */
  reservationTokenPlain: string;
  /** メール表示用（例: K3M9-P2QX-7VNA-8D4H） */
  reservationTokenDisplay: string;
  /** 予約番号（表示・問い合わせ用） */
  publicRef: string;
  /** 指定時はこの通知行だけを sent/failed に更新（再送で pending を複数置いたときのため） */
  notificationId?: string | null;
  /** 統合イベント（将来 webhook）の発火元区別 */
  deliveryTrigger?: ReservationCreatedMailDeliveryTrigger;
}): Promise<void> {
  const {
    supabase,
    reservationId,
    to,
    contactName,
    teamName,
    eventDateIso,
    gradeBand,
    representativeGradeYear,
    reservationTokenPlain,
    reservationTokenDisplay,
    publicRef,
    notificationId: notificationIdRaw,
    deliveryTrigger = "public_reservation_created",
  } = params;
  const notificationId = notificationIdRaw?.trim() || undefined;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[reservation email] skipped: set RESEND_API_KEY and RESEND_FROM (notifications stay pending)"
    );
    await dispatchReservationCreatedMailDeliveryEvent({
      templateKey: "reservation_created",
      reservationId,
      notificationId,
      trigger: deliveryTrigger,
      outcome: "skipped_no_mailer",
      occurredAt: new Date().toISOString(),
    });
    return;
  }

  const eventLine =
    eventDateIso && /^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)
      ? formatIsoDateWithWeekdayJa(eventDateIso)
      : "開催日は予約画面の開催日一覧でご確認ください。";
  /** 本文ラベルは全角コロンで統一 */
  const colon = "\uFF1A";
  const gradeLine = gradeBand?.trim()
    ? `学年帯${colon}${gradeBand.trim()}`
    : null;
  const repYearLine = `代表学年${colon}${gradeYearLabelJa(representativeGradeYear)}`;
  const manageUrl = managePageUrl();
  const manageDirectUrl = manageViewUrlWithToken(reservationTokenPlain);
  const contactUrl = reserveContactPageUrl();

  const escaped = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const { data: lunchRows } = await supabase
    .from("reservation_lunch_items")
    .select(
      "item_name_snapshot, unit_price_snapshot_tax_included, quantity, line_total, created_at"
    )
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true });

  const lunchSorted = [...(lunchRows ?? [])].sort(
    (a, b) =>
      new Date(String((a as { created_at: string }).created_at)).getTime() -
      new Date(String((b as { created_at: string }).created_at)).getTime()
  );

  const lunchLinesText: string[] = [];
  let lunchTotal = 0;
  for (const r of lunchSorted) {
    const row = r as {
      item_name_snapshot: string;
      unit_price_snapshot_tax_included: number;
      quantity: number;
      line_total: number;
    };
    lunchTotal += Number(row.line_total) || 0;
    lunchLinesText.push(
      `${row.item_name_snapshot}　${formatTaxIncludedYen(Number(row.unit_price_snapshot_tax_included))} × ${row.quantity}食 ＝ ${formatTaxIncludedYen(Number(row.line_total))}`
    );
  }
  const lunchBlockText =
    lunchLinesText.length > 0
      ? [
          "",
          "【昼食のご注文】",
          ...lunchLinesText,
          "",
          `昼食合計${colon}${formatTaxIncludedYen(lunchTotal)}`,
          "",
          "昼食代は、各チームの代表者様が当日まとめてお支払いください。",
        ]
      : [
          "",
          "【昼食のご注文】",
          "今回の予約では昼食の申込はありません。",
        ];

  const lunchLinesHtml =
    lunchLinesText.length > 0
      ? lunchSorted
          .map((r) => {
            const row = r as {
              item_name_snapshot: string;
              unit_price_snapshot_tax_included: number;
              quantity: number;
              line_total: number;
            };
            const line = `${row.item_name_snapshot}　${formatTaxIncludedYen(Number(row.unit_price_snapshot_tax_included))} × ${row.quantity}食 ＝ ${formatTaxIncludedYen(Number(row.line_total))}`;
            return `<p style="margin:6px 0">${escaped(line)}</p>`;
          })
          .join("")
      : `<p>今回の予約では昼食の申込はありません。</p>`;

  const lunchBlockHtml =
    lunchLinesText.length > 0
      ? `<p style="margin-top:20px;font-size:15px"><strong>【昼食のご注文】</strong></p>${lunchLinesHtml}<p style="margin-top:8px"><strong>昼食合計${colon}</strong>${escaped(formatTaxIncludedYen(lunchTotal))}</p><p>${escaped("昼食代は、各チームの代表者様が当日まとめてお支払いください。")}</p>`
      : `<p style="margin-top:20px;font-size:15px"><strong>【昼食のご注文】</strong></p>${lunchLinesHtml}`;

  const subject = `${MAIL_SUBJECT_BRAND_USER}お申し込み完了のお知らせ`;

  const guideLines = [
    "【ご案内】",
    "・予約内容の確認・変更・キャンセルには、確認コード が必要です。",
    "・確認コードは第三者に教えず、大切に保管してください。",
    "・予約内容の変更・キャンセルは、開催2日前の15:00まで可能です。",
    "・リンクが開けない場合は、下記の確認コードを「予約の確認・キャンセル」ページに入力してください。",
    "",
    ...(manageDirectUrl
      ? ["予約内容の確認・キャンセル（直接リンク）", manageDirectUrl, ""]
      : []),
    ...(manageUrl
      ? ["予約の確認・キャンセル（入力ページ）", manageUrl, ""]
      : ["サイトの「予約の確認・キャンセル」ページより操作できます。", ""]),
  ];

  const footerLines = [
    "",
    contactUrl
      ? `ご不明な点がございましたら、サイトのお問い合わせページ（${contactUrl}）よりご連絡ください。`
      : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。",
    "なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。",
    "",
    "よろしくお願いいたします。",
  ];

  const text = [
    `${contactName} 様`,
    "",
    `このたびは、${MAIL_BODY_SERVICE_NAME}にお申し込みいただきありがとうございます。`,
    "以下の内容でご予約を受け付けました。",
    "",
    ...guideLines,
    "【お申し込み内容】",
    `予約番号${colon}${publicRef}`,
    `チーム名${colon}${teamName}`,
    `開催日${colon}${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    repYearLine,
    ...lunchBlockText,
    "",
    "【確認コード】",
    reservationTokenDisplay,
    ...footerLines,
  ].join("\n");

  const tokenHtml = `<pre style="font-size:15px;letter-spacing:0.02em;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px;border:1px solid #e4e4e7">${escaped(reservationTokenDisplay)}</pre>`;
  const manageDirectHtml = manageDirectUrl
    ? `<p style="margin-top:12px"><a href="${escaped(manageDirectUrl)}">予約内容の確認・キャンセル（リンク）</a></p>`
    : "";
  const manageHtml = manageUrl
    ? `<p style="margin-top:8px"><a href="${escaped(manageUrl)}">予約の確認・キャンセル（確認コード入力）</a></p>`
    : `<p style="margin-top:12px">サイトの「予約の確認・キャンセル」ページより操作できます。</p>`;

  const guideHtml = `<p style="margin-top:20px;font-size:15px"><strong>【ご案内】</strong></p>
<ul style="margin-top:8px;padding-left:1.25rem">
<li>予約内容の確認・変更・キャンセルには、確認コード が必要です。</li>
<li>確認コードは第三者に教えず、大切に保管してください。</li>
<li>予約内容の変更・キャンセルは、開催2日前の15:00まで可能です。</li>
<li>リンクが開けない場合は、下記の確認コードを入力してください。</li>
</ul>
${manageDirectHtml}
${manageHtml}`;

  const applicationHtml = `<p style="margin-top:20px;font-size:15px"><strong>【お申し込み内容】</strong></p>
<ul style="margin-top:8px;padding-left:1.25rem">
<li>予約番号${colon}${escaped(publicRef)}</li>
<li>チーム名${colon}${escaped(teamName)}</li>
<li>開催日${colon}${escaped(eventLine)}</li>
${gradeBand?.trim() ? `<li>学年帯${colon}${escaped(gradeBand.trim())}</li>` : ""}
<li>代表学年${colon}${escaped(gradeYearLabelJa(representativeGradeYear))}</li>
</ul>`;

  const footerHtml = `<p style="margin-top:20px">${contactUrl ? `ご不明な点がございましたら、<a href="${escaped(contactUrl)}">お問い合わせページ</a>よりご連絡ください。` : "ご不明な点がございましたら、サイトのお問い合わせページよりご連絡ください。"}</p>
<p>なお、こちらは送信専用メールアドレスのため、返信いただいてもご回答できません。</p>
<p>よろしくお願いいたします。</p>`;

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.65;color:#18181b;font-size:15px">
<p>${escaped(contactName)} 様</p>
<p>このたびは、${escaped(MAIL_BODY_SERVICE_NAME)}にお申し込みいただきありがとうございます。<br/>
以下の内容でご予約を受け付けました。</p>
${guideHtml}
${applicationHtml}
${lunchBlockHtml}
<p style="margin-top:20px;font-size:15px"><strong>【確認コード】</strong></p>
${tokenHtml}
${footerHtml}
</body></html>`;

  const resend = new Resend(apiKey);

  async function patchPendingNotification(patch: {
    status: string;
    error_message: string | null;
  }): Promise<void> {
    let q = supabase
      .from("notifications")
      .update(patch)
      .eq("reservation_id", reservationId)
      .eq("template_key", TEMPLATE_KEY)
      .eq("status", "pending");
    if (notificationId) {
      q = q.eq("id", notificationId);
    }
    await q;
  }

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
      await patchPendingNotification({ status: "failed", error_message: msg });
      await notifyOpsReservationCreatedDeliveryFailed({
        reservationId,
        teamName,
        intendedTo: to,
        resendError: msg,
      });
      await dispatchReservationCreatedMailDeliveryEvent({
        templateKey: "reservation_created",
        reservationId,
        notificationId,
        trigger: deliveryTrigger,
        outcome: "failed",
        occurredAt: new Date().toISOString(),
        errorMessage: msg,
      });
      return;
    }

    await patchPendingNotification({ status: "sent", error_message: null });
    await dispatchReservationCreatedMailDeliveryEvent({
      templateKey: "reservation_created",
      reservationId,
      notificationId,
      trigger: deliveryTrigger,
      outcome: "sent",
      occurredAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = truncateErrorMessage(
      e instanceof Error ? e.message : "Unknown email error"
    );
    await patchPendingNotification({ status: "failed", error_message: msg });
    await notifyOpsReservationCreatedDeliveryFailed({
      reservationId,
      teamName,
      intendedTo: to,
      resendError: msg,
    });
    await dispatchReservationCreatedMailDeliveryEvent({
      templateKey: "reservation_created",
      reservationId,
      notificationId,
      trigger: deliveryTrigger,
      outcome: "failed",
      occurredAt: new Date().toISOString(),
      errorMessage: msg,
    });
  }
}
