import Link from "next/link";
import { notFound } from "next/navigation";

import { InquiryInternalNoteSection } from "../../_components/inquiry-internal-note-section";
import {
  TournamentInquiryContactSection,
  TournamentInquiryStatusSection,
} from "../tournament-inquiry-detail-manage-client";
import {
  buildInquiryComposeBundleLimited,
  formatInquiryReplyClipboardBlock,
  formatTournamentInquiryMailDraft,
} from "@/lib/admin/inquiry-mailto-draft";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { InquiryStatusBadge } from "@/components/admin/inquiry-status-badge";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  message: string;
  internal_note: string | null;
};

/** 管理: 大会お問い合わせの詳細 */
export default async function AdminTournamentInquiryDetailPage({
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
    .from("tournament_inquiries")
    .select(
      "id, created_at, updated_at, status, contact_name, contact_email, contact_phone, message, internal_note"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const row = data as Row;
  const mailDraft = formatTournamentInquiryMailDraft(row);
  const replySubject = `【お問い合わせ】${row.contact_name.trim() || "（無記名）"}様への返信`;
  const compose = buildInquiryComposeBundleLimited({
    toEmail: row.contact_email,
    subject: replySubject,
    body: mailDraft,
  });
  const replyClipboardText = formatInquiryReplyClipboardBlock({
    toEmail: row.contact_email,
    subject: replySubject,
    bodyFull: mailDraft,
  });

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-zinc-500">対応案件</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">お問い合わせ · 詳細</h1>
          <InquiryStatusBadge status={row.status} />
        </div>
        <Link
          href="/admin/tournament-inquiries"
          className="inline-flex min-h-10 items-center text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          ← 一覧へ
        </Link>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">受付内容</h2>
        <dl className="mt-4 space-y-3">
          <div className="grid gap-1 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500 sm:text-sm">お名前</dt>
            <dd className="whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
              {row.contact_name}
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500 sm:text-sm">
              メールアドレス
            </dt>
            <dd className="wrap-break-word text-sm text-zinc-900">{row.contact_email}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500 sm:text-sm">
              電話番号
            </dt>
            <dd className="wrap-break-word font-mono text-sm text-zinc-900">
              {row.contact_phone?.trim() ? row.contact_phone.trim() : "—"}
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500 sm:text-sm">
              お問い合わせ内容
            </dt>
            <dd className="whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
              {row.message}
            </dd>
          </div>
        </dl>
      </section>

      <TournamentInquiryStatusSection inquiryId={row.id} initialStatus={row.status} />

      <InquiryInternalNoteSection
        inquiryId={row.id}
        apiPath={`/api/admin/tournament-inquiries/${row.id}`}
        initialInternalNote={row.internal_note}
      />

      <TournamentInquiryContactSection
        contactEmail={row.contact_email}
        contactPhone={row.contact_phone}
        outlookWebHref={compose.outlookWebHref}
        mailtoHref={compose.mailtoHref}
        mailtoTruncated={compose.truncated}
        replyClipboardText={replyClipboardText}
      />

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
