import Link from "next/link";
import { notFound } from "next/navigation";

import { InquiryInternalNoteSection } from "../../_components/inquiry-internal-note-section";
import { CampInquiryDetailManageClient } from "../camp-inquiry-detail-manage-client";
import { InquiryStatusBadge } from "@/components/admin/inquiry-status-badge";
import { CAMP_INQUIRY_FIELD_DEFS } from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import { getLodgingPlanLabelJa } from "@/lib/camp-inquiry/camp-lodging-plans";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import {
  buildInquiryComposeBundleLimited,
  formatCampInquiryMailDraft,
  formatInquiryReplyClipboardBlock,
} from "@/lib/admin/inquiry-mailto-draft";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeAnswers(raw: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      answers[k] = v == null ? "" : String(v);
    }
  }
  return answers;
}

function displayFieldValue(defId: string, raw: string): string {
  if (defId === "preferred_plan" && raw.trim() !== "") {
    return getLodgingPlanLabelJa(raw) ?? raw;
  }
  return raw;
}

type Row = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  answers: unknown;
  internal_note: string | null;
};

/** 管理: 合宿相談の詳細 */
export default async function AdminCampInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("camp_inquiries")
    .select("id, created_at, updated_at, status, answers, internal_note")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const row = data as Row;
  const answers = normalizeAnswers(row.answers);
  const teamName = (answers.team_name ?? "").trim();
  const toEmail = (answers.contact_email ?? "").trim();
  const mailDraft = formatCampInquiryMailDraft(answers, {
    inquiryId: row.id,
    createdAtIso: row.created_at,
  });
  const replySubject = `【合宿相談】${teamName || "（チーム名なし）"}への返信`;
  const compose = buildInquiryComposeBundleLimited({
    toEmail,
    subject: replySubject,
    body: mailDraft,
  });
  const replyClipboardText = formatInquiryReplyClipboardBlock({
    toEmail,
    subject: replySubject,
    bodyFull: mailDraft,
  });

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/camp-inquiries"
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          ← 一覧へ
        </Link>
        <InquiryStatusBadge status={row.status} />
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wide text-zinc-500">対応案件</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">合宿相談 · 詳細</h1>
      </div>

      <InquiryInternalNoteSection
        inquiryId={row.id}
        apiPath={`/api/admin/camp-inquiries/${row.id}`}
        initialInternalNote={row.internal_note}
      />

      <CampInquiryDetailManageClient
        inquiryId={row.id}
        initialStatus={row.status}
        contactEmail={answers.contact_email ?? ""}
        contactPhone={answers.contact_phone ?? ""}
        outlookWebHref={compose.outlookWebHref}
        mailtoHref={compose.mailtoHref}
        mailtoTruncated={compose.truncated}
        replyClipboardText={replyClipboardText}
      />

      <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">受付内容</h2>
        <dl className="mt-4 divide-y divide-zinc-100">
          {CAMP_INQUIRY_FIELD_DEFS.flatMap((def) => {
            /* 確認入力は運用上不要（本体メールのみ表示） */
            if (def.id === "contact_email_confirm") {
              return [];
            }
            const raw = answers[def.id] ?? "";
            if (def.hiddenFromPublicForm && raw.trim() === "") {
              return [];
            }
            const shown = raw.trim() === "" ? "—" : displayFieldValue(def.id, raw);
            return [
              <div
                key={def.id}
                className="grid gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4"
              >
                <dt className="text-xs font-medium text-zinc-500 sm:text-sm">
                  {def.labelJa}
                  {def.required ? null : (
                    <span className="ml-1 text-zinc-400">（任意）</span>
                  )}
                </dt>
                <dd className="whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
                  {shown}
                </dd>
              </div>,
            ];
          })}
        </dl>
      </div>

      <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-4 py-3 text-xs leading-relaxed text-zinc-600 sm:text-sm">
        <p>
          <span className="font-medium text-zinc-800">受付日時: </span>
          {formatDateTimeTokyoWithWeekday(row.created_at)}
        </p>
        <p className="mt-1">
          <span className="font-medium text-zinc-800">最終更新: </span>
          {formatDateTimeTokyoWithWeekday(row.updated_at)}
        </p>
      </div>
    </div>
  );
}
