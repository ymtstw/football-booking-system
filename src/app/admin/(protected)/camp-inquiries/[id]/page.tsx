import Link from "next/link";
import { notFound } from "next/navigation";

import { CampInquiryDetailManageClient } from "../camp-inquiry-detail-manage-client";
import { CAMP_INQUIRY_FIELD_DEFS } from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import { campInquiryStatusLabelJa } from "@/lib/camp-inquiry/camp-inquiry-status";
import { getLodgingPlanLabelJa } from "@/lib/camp-inquiry/camp-lodging-plans";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
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
  schema_version: string;
  answers: unknown;
  source_path: string | null;
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
    .select(
      "id, created_at, updated_at, status, schema_version, answers, source_path"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const row = data as Row;
  const answers = normalizeAnswers(row.answers);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/camp-inquiries"
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
          合宿相談の詳細
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 sm:text-sm">{row.id}</p>
      </div>

      <CampInquiryDetailManageClient
        inquiryId={row.id}
        initialStatus={row.status}
        contactEmail={answers.contact_email ?? ""}
        contactPhone={answers.contact_phone ?? ""}
        teamName={answers.team_name ?? ""}
      />

      <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">受付内容</h2>
        <dl className="mt-4 divide-y divide-zinc-100">
          {CAMP_INQUIRY_FIELD_DEFS.map((def) => {
            const raw = answers[def.id] ?? "";
            const shown = raw.trim() === "" ? "—" : displayFieldValue(def.id, raw);
            return (
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
              </div>
            );
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
        <p className="mt-1">
          <span className="font-medium text-zinc-800">スキーマ: </span>
          {row.schema_version}
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
