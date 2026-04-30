import Link from "next/link";
import type { ReactNode } from "react";

import { InquiryInternalNotePresenceLabel } from "@/components/admin/inquiry-internal-note-presence";
import { InquiryStatusBadge } from "@/components/admin/inquiry-status-badge";
import {
  type InquiryListPeriod,
  type InquiryListTab,
  inquiryListHref,
  inquiryListSupabaseFilters,
  parseInquiryListQuery,
  rollingThirtyDaysCutoffIso,
} from "@/lib/admin/inquiry-admin-list-query";
import { fetchInquiryTabCountsForPage } from "@/lib/admin/inquiry-count-queries";
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
  internal_note: string | null;
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

function tabLabelWithCount(base: string, count: number): string {
  return count > 0 ? `${base} · ${count}` : base;
}

function trimmedOrDash(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s === "" ? "—" : s;
}

function emptyMessageCamp(tab: InquiryListTab, period: InquiryListPeriod): string {
  if (tab === "todo") return "要対応の相談はありません。";
  if (tab === "in_progress") return "対応中の相談はありません。";
  if (tab === "done") {
    return period === "recent"
      ? "直近30日以内に対応済みになった相談はありません。"
      : "30日より前に対応済みになった相談はありません。";
  }
  return period === "recent"
    ? "直近30日以内の相談はありません。"
    : "30日より前の相談はありません。";
}

/** 管理: 合宿相談一覧 */
export default async function AdminCampInquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string | string[] | undefined;
    period?: string | string[] | undefined;
    status?: string | string[] | undefined;
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const { tab, period } = parseInquiryListQuery(sp);
  const cutoffIso = rollingThirtyDaysCutoffIso();
  const filters = inquiryListSupabaseFilters(tab, period, cutoffIso);

  const supabase = await createClient();
  const tabCounts = await fetchInquiryTabCountsForPage(supabase, "camp_inquiries", period);

  let query = supabase
    .from("camp_inquiries")
    .select(
      "id, created_at, updated_at, status, schema_version, answers, source_path, internal_note"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.statusIn) {
    query = query.in("status", [...filters.statusIn]);
  }
  if (filters.statusEq) {
    query = query.eq("status", filters.statusEq);
  }
  if (filters.createdGte) {
    query = query.gte("created_at", filters.createdGte);
  }
  if (filters.createdLt) {
    query = query.lt("created_at", filters.createdLt);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as CampInquiryRow[];

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">対応案件</h1>
        <h2 className="text-lg font-semibold text-zinc-800 sm:text-xl">合宿相談</h2>
        <p className="text-sm leading-relaxed text-zinc-600">
          公開フォームから届いた合宿相談を確認できます。
          <br />
          内容を確認し、必要に応じて担当者から返信してください。
        </p>
      </header>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={inquiryListHref("/admin/camp-inquiries", "todo", "recent")}
            className={tabClass(tab === "todo")}
            aria-current={tab === "todo" ? "page" : undefined}
          >
            {tabLabelWithCount("要対応", tabCounts.todo)}
          </Link>
          <Link
            href={inquiryListHref("/admin/camp-inquiries", "in_progress", "recent")}
            className={tabClass(tab === "in_progress")}
            aria-current={tab === "in_progress" ? "page" : undefined}
          >
            {tabLabelWithCount("対応中", tabCounts.inProgress)}
          </Link>
          <Link
            href={inquiryListHref("/admin/camp-inquiries", "done", "recent")}
            className={tabClass(tab === "done")}
            aria-current={tab === "done" ? "page" : undefined}
          >
            {tabLabelWithCount("対応済み", tabCounts.done)}
          </Link>
          <Link
            href={inquiryListHref("/admin/camp-inquiries", "all", "recent")}
            className={tabClass(tab === "all")}
            aria-current={tab === "all" ? "page" : undefined}
          >
            {tabLabelWithCount("すべて", tabCounts.all)}
          </Link>
        </div>
        {(tab === "done" || tab === "all") && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">受付日時</span>
            <Link
              href={inquiryListHref("/admin/camp-inquiries", tab, "recent")}
              className={tabClass(period === "recent")}
              aria-current={period === "recent" ? "page" : undefined}
            >
              直近30日
            </Link>
            <Link
              href={inquiryListHref("/admin/camp-inquiries", tab, "older")}
              className={tabClass(period === "older")}
              aria-current={period === "older" ? "page" : undefined}
            >
              それ以前
            </Link>
          </div>
        )}
      </div>

      {error ? (
        <p className="wrap-break-word text-sm text-red-600">
          取得に失敗しました: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyMessageCamp(tab, period)}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const a = normalizeAnswers(row.answers);
              const contactName = trimmedOrDash(a.contact_name);
              const preferredDates = trimmedOrDash(a.preferred_dates);
              const message = trimmedOrDash(a.inquiry_message);
              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80"
                >
                  <p className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">受付日時</span>{" "}
                    {formatDateTimeTokyoWithWeekday(row.created_at)}
                  </p>
                  <dl className="mt-3 space-y-2.5 text-sm text-zinc-900">
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">代表者名</dt>
                      <dd className="mt-0.5 wrap-break-word font-medium text-zinc-900">
                        {contactName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">希望日程</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
                        {preferredDates}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">相談内容</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
                        {message}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">対応メモ</dt>
                        <dd className="mt-1">
                          <InquiryInternalNotePresenceLabel internalNote={row.internal_note} />
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs font-medium text-zinc-500">ステータス</dt>
                        <dd className="mt-1">
                          <InquiryStatusBadge status={row.status} />
                        </dd>
                      </div>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <Link
                      href={`/admin/camp-inquiries/${row.id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      詳細
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden min-w-0 max-w-full md:block">
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
              <table className="min-w-240 w-full border-collapse text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 sm:text-sm">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">受付日時</th>
                    <th className="min-w-40 px-3 py-2.5 sm:px-4">代表者名</th>
                    <th className="min-w-48 px-3 py-2.5 sm:px-4">希望日程</th>
                    <th className="min-w-72 px-3 py-2.5 sm:px-4">相談内容</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">対応メモ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">ステータス</th>
                    <th className="sticky right-0 z-20 min-w-26 whitespace-nowrap border-l border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.12)] sm:px-4">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row) => {
                    const a = normalizeAnswers(row.answers);
                    const contactName = trimmedOrDash(a.contact_name);
                    const preferredDates = trimmedOrDash(a.preferred_dates);
                    const message = trimmedOrDash(a.inquiry_message);
                    return (
                      <tr key={row.id} className="group align-top text-zinc-900">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                          {formatDateTimeTokyoWithWeekday(row.created_at)}
                        </td>
                        <td className="max-w-56 px-3 py-2.5 sm:px-4">
                          <div className="wrap-break-word font-medium">{contactName}</div>
                        </td>
                        <td className="max-w-72 px-3 py-2.5 sm:px-4">
                          <div className="line-clamp-3 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
                            {preferredDates}
                          </div>
                        </td>
                        <td className="max-w-104 px-3 py-2.5 sm:px-4">
                          <div className="line-clamp-3 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">
                            {message}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                          <InquiryInternalNotePresenceLabel internalNote={row.internal_note} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                          <InquiryStatusBadge status={row.status} />
                        </td>
                        <td className="sticky right-0 z-10 min-w-26 whitespace-nowrap border-l border-zinc-200 bg-white px-2 py-2 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.12)] group-hover:bg-zinc-50 sm:px-3">
                          <Link
                            href={`/admin/camp-inquiries/${row.id}`}
                            className="inline-flex min-h-9 w-full min-w-19 items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50"
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
          </div>
        </>
      )}
    </div>
  );
}
