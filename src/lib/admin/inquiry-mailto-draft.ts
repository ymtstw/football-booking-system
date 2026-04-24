import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import {
  CAMP_INQUIRY_FIELD_DEFS,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import { getLodgingPlanLabelJa } from "@/lib/camp-inquiry/camp-lodging-plans";

/** mailto / Webメールの compose URL が長すぎると失敗することがあるための上限（目安） */
const DEFAULT_MAX_MAILTO_URL_CHARS = 7500;

const COMPOSE_TRUNCATION_NOTE =
  "\n\n…（文字数の都合で省略しています。管理画面の「受付内容」に全文があります）";

/** 返信下書き末尾：運営がお客様へ送る際の注意（宛先はお客様のまま） */
const INQUIRY_REPLY_DRAFT_OPERATOR_NOTE =
  "お客様へ返信する場合は、このメールの宛先のままご返信ください。";

export type InquiryComposeBundle = {
  mailtoHref: string | null;
  /** Microsoft 365 / Outlook on the web（ブラウザ） */
  outlookWebHref: string | null;
  truncated: boolean;
};

/** Outlook（Web）・mailto 用。URL が長すぎる場合は本文を共通で短縮する。 */
export function buildInquiryComposeBundleLimited(params: {
  toEmail: string;
  subject: string;
  body: string;
  maxUrlChars?: number;
}): InquiryComposeBundle {
  const maxUrl = params.maxUrlChars ?? DEFAULT_MAX_MAILTO_URL_CHARS;
  const to = params.toEmail.trim();
  if (!to) {
    return {
      mailtoHref: null,
      outlookWebHref: null,
      truncated: false,
    };
  }

  const subject = params.subject;
  let body = params.body.replace(/\r\n/g, "\n");
  let truncated = false;

  const build = (b: string) => {
    const encBody = encodeURIComponent(b);
    const encTo = encodeURIComponent(to);
    const encSub = encodeURIComponent(subject);
    return {
      mailto: `mailto:${encTo}?subject=${encSub}&body=${encBody}`,
      outlook: `https://outlook.office.com/mail/deeplink/compose?to=${encTo}&subject=${encSub}&body=${encBody}`,
    };
  };

  let urls = build(body);
  let maxLen = Math.max(urls.mailto.length, urls.outlook.length);

  while (maxLen > maxUrl && body.length > 120) {
    truncated = true;
    body =
      body.slice(0, Math.max(120, Math.floor(body.length * 0.72))) +
      COMPOSE_TRUNCATION_NOTE;
    urls = build(body);
    maxLen = Math.max(urls.mailto.length, urls.outlook.length);
  }

  return {
    mailtoHref: urls.mailto,
    outlookWebHref: urls.outlook,
    truncated,
  };
}

/** 任意のメールクライアントに貼り付け用（宛先・件名・全文本文。省略なし） */
export function formatInquiryReplyClipboardBlock(params: {
  toEmail: string;
  subject: string;
  bodyFull: string;
}): string {
  return [
    `宛先: ${params.toEmail.trim()}`,
    `件名: ${params.subject}`,
    "",
    params.bodyFull.replace(/\r\n/g, "\n"),
  ].join("\n");
}

function displayAnswerLine(defId: string, raw: string): string {
  if (defId === "preferred_plan" && raw.trim() !== "") {
    return getLodgingPlanLabelJa(raw) ?? raw;
  }
  return raw;
}

/** 合宿相談の返信メール下書き用プレーンテキスト */
export function formatCampInquiryMailDraft(
  answers: Record<string, string>,
  meta: {
    inquiryId: string;
    createdAtIso: string;
    schemaVersion: string;
  }
): string {
  const lines: string[] = [
    "以下は、サイトの合宿のご相談フォームより受付した内容です。",
    "",
    `照会ID: ${meta.inquiryId}`,
    `受付日時: ${formatDateTimeTokyoWithWeekday(meta.createdAtIso)}`,
    `スキーマ: ${meta.schemaVersion}`,
    "",
  ];
  for (const def of CAMP_INQUIRY_FIELD_DEFS) {
    const raw = answers[def.id] ?? "";
    if (def.hiddenFromPublicForm && raw.trim() === "") continue;
    const shown = raw.trim() === "" ? "（未入力）" : displayAnswerLine(def.id, raw);
    lines.push(`${def.labelJa}: ${shown}`);
  }
  lines.push("", INQUIRY_REPLY_DRAFT_OPERATOR_NOTE);
  return lines.join("\n");
}

type TournamentRow = {
  id: string;
  created_at: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  message: string;
  source_path: string | null;
};

/** 大会お問い合わせの返信メール下書き用プレーンテキスト */
export function formatTournamentInquiryMailDraft(row: TournamentRow): string {
  const lines = [
    "以下は、サイトの「お問い合わせ」フォームより受付した内容です。",
    "",
    `照会ID: ${row.id}`,
    `受付日時: ${formatDateTimeTokyoWithWeekday(row.created_at)}`,
    "",
    `お名前: ${row.contact_name}`,
    `メールアドレス: ${row.contact_email}`,
    `電話番号: ${row.contact_phone?.trim() ? row.contact_phone.trim() : "（未入力）"}`,
    ...(row.source_path?.trim()
      ? [`送信元パス: ${row.source_path.trim()}`]
      : []),
    "",
    "【お問い合わせ内容】",
    row.message,
    "",
    INQUIRY_REPLY_DRAFT_OPERATOR_NOTE,
  ];
  return lines.join("\n");
}

export function buildMailtoHrefLimited(params: {
  toEmail: string;
  subject: string;
  body: string;
  /** mailto: 全体の最大文字数（encode 後） */
  maxUrlChars?: number;
}): { href: string | null; truncated: boolean } {
  const b = buildInquiryComposeBundleLimited(params);
  return { href: b.mailtoHref, truncated: b.truncated };
}
