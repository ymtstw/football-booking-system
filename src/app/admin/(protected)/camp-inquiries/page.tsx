import Link from "next/link";

import {
  CAMP_INQUIRY_SCHEMA_VERSION,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import {
  campInquiryStatusLabelJa,
  isCampInquiryStatus,
} from "@/lib/camp-inquiry/camp-inquiry-status";
import { getLodgingPlanLabelJa } from "@/lib/camp-inquiry/camp-lodging-plans";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

type CampInquiryRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  schema_version: string;
  answers: unknown;
  source_path: string | null;
};

function normalizeAnswers(raw: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      answers[k] = v == null ? "" : String(v);
    }
  }
  return answers;
}

function tabClass(active: boolean): string {
  return [
    "inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-zinc-900 bg-zinc-900 text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
  ].join(" ");
}

/** 管理: 合宿相談一覧（受付の把握・ステータスで絞り込み） */
export default async function AdminCampInquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw =
    typeof sp.status === "string"
      ? sp.status
      : Array.isArray(sp.status)
        ? sp.status[0]
        : undefined;
  const statusFilter = raw && isCampInquiryStatus(raw) ? raw : null;

  const supabase = await createClient();
  let query = supabase
    .from("camp_inquiries")
    .select(
      "id, created_at, updated_at, status, schema_version, answers, source_path"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as CampInquiryRow[];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
          合宿相談
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          公開フォームから届いた<strong className="text-zinc-800">宿泊合宿の相談受付</strong>
          です。用途は受付内容の確認と、対応状況の最低限の管理までです（スキーマ{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            {CAMP_INQUIRY_SCHEMA_VERSION}
          </code>
          ）。<strong className="text-zinc-800">予約確定ではありません</strong>
          。返信・詳細調整は通常メールで行い、本画面からメール送信はしません。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          新着は{" "}
          <code className="text-xs">CAMP_INQUIRY_NOTIFY_EMAIL</code>{" "}
          設定時に通知メールでも届きます（再通知は MVP 対象外）。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/camp-inquiries"
          className={tabClass(statusFilter === null)}
          aria-current={statusFilter === null ? "page" : undefined}
        >
          すべて
        </Link>
        <Link
          href="/admin/camp-inquiries?status=new"
          className={tabClass(statusFilter === "new")}
          aria-current={statusFilter === "new" ? "page" : undefined}
        >
          未対応
        </Link>
        <Link
          href="/admin/camp-inquiries?status=in_progress"
          className={tabClass(statusFilter === "in_progress")}
          aria-current={statusFilter === "in_progress" ? "page" : undefined}
        >
          対応中
        </Link>
        <Link
          href="/admin/camp-inquiries?status=done"
          className={tabClass(statusFilter === "done")}
          aria-current={statusFilter === "done" ? "page" : undefined}
        >
          対応済み
        </Link>
      </div>

      {error ? (
        <p className="wrap-break-word text-sm text-red-600">
          取得に失敗しました: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          {statusFilter
            ? "このステータスの相談はありません。"
            : "まだ相談の受付がありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-[56rem] w-full border-collapse text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 sm:text-sm">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">受付日時</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">代表者名</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                  所属チーム名
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">希望プラン</th>
                <th className="min-w-[10rem] px-3 py-2.5 sm:px-4">希望日程</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">概算人数</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">ステータス</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => {
                const a = normalizeAnswers(row.answers);
                const planId = a.preferred_plan?.trim() ?? "";
                const planLabel =
                  planId === ""
                    ? "—"
                    : getLodgingPlanLabelJa(planId) ?? planId;
                const dates = a.preferred_dates?.trim() ?? "—";
                const headcount = a.headcount?.trim() ?? "—";
                return (
                  <tr key={row.id} className="align-top text-zinc-900">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                      {formatDateTimeTokyoWithWeekday(row.created_at)}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 sm:px-4">
                      {a.contact_name?.trim() || "—"}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5 sm:px-4">
                      {a.team_name?.trim() || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 sm:px-4">
                      {planLabel}
                    </td>
                    <td
                      className="max-w-xs px-3 py-2.5 text-xs leading-snug sm:px-4 sm:text-sm"
                      title={dates === "—" ? undefined : dates}
                    >
                      <span className="line-clamp-2 whitespace-pre-wrap">
                        {dates}
                      </span>
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2.5 sm:px-4">
                      {headcount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {campInquiryStatusLabelJa(row.status)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      <Link
                        href={`/admin/camp-inquiries/${row.id}`}
                        className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
