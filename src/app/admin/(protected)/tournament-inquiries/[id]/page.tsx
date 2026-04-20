import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentInquiryDetailManageClient } from "../tournament-inquiry-detail-manage-client";
import {
  buildInquiryComposeBundleLimited,
  formatInquiryReplyClipboardBlock,
  formatTournamentInquiryMailDraft,
} from "@/lib/admin/inquiry-mailto-draft";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { campInquiryStatusLabelJa } from "@/lib/camp-inquiry/camp-inquiry-status";
import { formatAdminIdTail } from "@/lib/admin/operator-display";
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
  source_path: string | null;
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
      "id, created_at, updated_at, status, contact_name, contact_email, contact_phone, message, source_path"
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
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/tournament-inquiries"
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          ← 一覧へ
        </Link>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
          {campInquiryStatusLabelJa(row.status)}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
          お問い合わせの詳細
        </h1>
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
          照会番号（末尾）:{" "}
          <span className="font-mono text-zinc-700">{formatAdminIdTail(row.id)}</span>
        </p>
      </div>

      <TournamentInquiryDetailManageClient
        inquiryId={row.id}
        initialStatus={row.status}
        contactEmail={row.contact_email}
        outlookWebHref={compose.outlookWebHref}
        mailtoHref={compose.mailtoHref}
        mailtoTruncated={compose.truncated}
        replyClipboardText={replyClipboardText}
      />

      <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
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
            <dd className="wrap-break-word text-sm text-zinc-900">
              {row.contact_email}
            </dd>
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
        {row.source_path ? (
          <p className="mt-1 break-all">
            <span className="font-medium text-zinc-800">送信元: </span>
            {row.source_path}
          </p>
        ) : null}
      </div>
    </div>
  );
}
