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
    ? `${base}/admin/notifications/failed`
    : "/admin/notifications/failed";

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
    `送信失敗一覧: ${failedListUrl}`,
    "",
    "（確認コードはこの通知には含めていません）",
  ].join("\n");

  const adminHref = base
    ? `${base}/admin/reservations/${params.reservationId}`
    : "";
  const failedHref = base ? `${base}/admin/notifications/failed` : "";
  const adminFailedLinksHtml =
    adminHref && failedHref
      ? `<p><a href="${escapeHtmlLite(adminHref)}">予約を管理画面で開く</a> · <a href="${escapeHtmlLite(failedHref)}">送信失敗一覧</a></p>`
      : `<p>管理画面パス: <code>${escapeHtmlLite(`/admin/reservations/${params.reservationId}`)}</code> / <code>/admin/notifications/failed</code>（<code>NEXT_PUBLIC_SITE_URL</code> 未設定時はリンク省略）</p>`;

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
    representativeGradeYear,
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
  const repYearLine = `代表学年: ${gradeYearLabelJa(representativeGradeYear)}`;
  const manageUrl = managePageUrl();
  const manageLine = manageUrl
    ? `予約の確認・変更（締切前）・キャンセル（締切前）:\n${manageUrl}`
    : "予約の確認・変更は、サイトの「予約確認・キャンセル」から行えます。";

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
      `・${row.item_name_snapshot}  ${formatTaxIncludedYen(Number(row.unit_price_snapshot_tax_included))} × ${row.quantity}食 ＝ ${formatTaxIncludedYen(Number(row.line_total))}`
    );
  }
  const lunchBlockText =
    lunchLinesText.length > 0
      ? [
          "",
          "▼ 昼食のご注文（税込・予約時点の単価で確定）",
          ...lunchLinesText,
          `昼食合計: ${formatTaxIncludedYen(lunchTotal)}`,
          "",
          "昼食代は、各チームの代表者が現地でまとめてお支払いください。",
        ]
      : [
          "",
          "▼ 昼食",
          "今回の予約では昼食の申込はありません。",
          "",
          "昼食をご利用の場合は、当日会場の案内に従ってください。",
        ];

  const lunchBlockHtml =
    lunchLinesText.length > 0
      ? `<p><strong>昼食のご注文</strong>（税込・予約時点の単価で確定）</p><ul>${lunchSorted
          .map((r) => {
            const row = r as {
              item_name_snapshot: string;
              unit_price_snapshot_tax_included: number;
              quantity: number;
              line_total: number;
            };
            return `<li>${escaped(row.item_name_snapshot)}　${escaped(formatTaxIncludedYen(Number(row.unit_price_snapshot_tax_included)))} × ${row.quantity}食 ＝ ${escaped(formatTaxIncludedYen(Number(row.line_total)))}</li>`;
          })
          .join("")}</ul><p><strong>昼食合計:</strong> ${escaped(formatTaxIncludedYen(lunchTotal))}</p><p>${escaped("昼食代は、各チームの代表者が現地でまとめてお支払いください。")}</p>`
      : `<p><strong>昼食</strong></p><p>今回の予約では昼食の申込はありません。</p>`;

  const subject = `${MAIL_SUBJECT_BRAND_USER}予約を受け付けました`;

  const emailNotReceivedLines = [
    "",
    "▼ メールが届かないとき",
    "・迷惑メールフォルダ（除外・迷惑メール等）も必ずご確認ください。",
    "・それでも見つからない場合は、ご登録のメールアドレスに誤りがある場合がございます。",
    contactUrl
      ? `・お手数ですが、次のお問い合わせフォームに、予約日・チーム名・電話番号をご記入のうえご連絡ください。\n${contactUrl}`
      : "・お手数ですが、サイトの「お問い合わせ」フォームから、予約日・チーム名・電話番号をご記入のうえご連絡ください。（公開サイトのメニューからお進みください）",
    "",
  ];

  const text = [
    `${contactName} 様`,
    "",
    `「${MAIL_BODY_SERVICE_NAME}」にお申し込みいただき、ありがとうございます。`,
    "日帰りの交流試合について、以下の内容でお申し込みを受け付けました。",
    "",
    "▼ まずお願いしたいこと",
    "・「予約確認コード」は他人に教えず、紛失しないよう保管してください（照会・変更・キャンセルに必要です）。",
    "・締切前であれば、次のページから予約内容の確認やキャンセルができます。",
    "",
    manageLine,
    "",
    "▼ お申し込み内容",
    `チーム名: ${teamName}`,
    `開催日: ${eventLine}`,
    ...(gradeLine ? [gradeLine] : []),
    repYearLine,
    ...lunchBlockText,
    "",
    "▼ 予約確認コード",
    reservationTokenPlain,
    ...emailNotReceivedLines,
    "本メールに心当たりがない場合は、お手数ですが破棄してください。",
  ].join("\n");

  const tokenHtml = `<pre style="font-size:12px;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px;border:1px solid #e4e4e7">${escaped(reservationTokenPlain)}</pre>`;
  const manageHtml = manageUrl
    ? `<p><a href="${escaped(manageUrl)}">予約の確認・キャンセルページを開く</a></p>`
    : `<p>サイトの「予約確認・キャンセル」から操作できます。</p>`;

  const emailNotReceivedHtml = `<p style="margin-top:20px;font-size:15px"><strong>メールが届かないとき</strong></p>
<ul style="margin-top:8px;font-size:14px">
<li>迷惑メールフォルダ（除外・迷惑メール等）も<strong>必ず</strong>ご確認ください。</li>
<li>それでも見つからない場合は、ご登録のメールアドレスに誤りがある場合がございます。</li>
<li>お手数ですが、${
    contactUrl
      ? `<a href="${escaped(contactUrl)}">お問い合わせフォーム</a>から、`
      : `サイトの「お問い合わせ」から、`
  }予約日・チーム名・電話番号をご記入のうえご連絡ください。</li>
</ul>`;

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;line-height:1.6;color:#18181b">
<p>${escaped(contactName)} 様</p>
<p>「${escaped(MAIL_BODY_SERVICE_NAME)}」にお申し込みいただき、ありがとうございます。<br/>
日帰りの交流試合について、以下の内容で<strong>お申し込みを受け付けました</strong>。</p>
<p style="margin-top:16px;font-size:15px"><strong>まずお願いしたいこと</strong></p>
<ul style="margin-top:8px">
<li>「予約確認コード」は他人に教えず、紛失しないよう保管してください（照会・変更・キャンセルに必要です）。</li>
<li>締切前であれば、次のページから予約内容の確認やキャンセルができます。</li>
</ul>
${manageHtml}
<p style="margin-top:20px;font-size:15px"><strong>お申し込み内容</strong></p>
<ul>
<li>チーム名: ${escaped(teamName)}</li>
<li>開催日: ${escaped(eventLine)}</li>
${
  gradeBand?.trim()
    ? `<li>学年帯: ${escaped(gradeBand.trim())}</li>`
    : ""
}
<li>代表学年: ${escaped(gradeYearLabelJa(representativeGradeYear))}</li>
</ul>
${lunchBlockHtml}
<p style="margin-top:20px"><strong>予約確認コード</strong></p>
${tokenHtml}
${emailNotReceivedHtml}
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
        .eq("template_key", TEMPLATE_KEY)
        .eq("status", "pending");
      await notifyOpsReservationCreatedDeliveryFailed({
        reservationId,
        teamName,
        intendedTo: to,
        resendError: msg,
      });
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
    await notifyOpsReservationCreatedDeliveryFailed({
      reservationId,
      teamName,
      intendedTo: to,
      resendError: msg,
    });
  }
}
