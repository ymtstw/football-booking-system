import Link from "next/link";

import {
  type InquiryListPeriod,
  type InquiryListTab,
  inquiryListHref,
  inquiryListSupabaseFilters,
  parseInquiryListQuery,
  rollingThirtyDaysCutoffIso,
} from "@/lib/admin/inquiry-admin-list-query";
import { campInquiryStatusLabelJa } from "@/lib/camp-inquiry/camp-inquiry-status";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

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

function tabClass(active: boolean): string {
  return [
    "inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-zinc-900 bg-zinc-900 text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
  ].join(" ");
}

function previewMessage(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function emptyMessageTournament(tab: InquiryListTab, period: InquiryListPeriod): string {
  if (tab === "todo") return "未対応・要再対応のお問い合わせはありません。";
  if (tab === "in_progress") return "対応中のお問い合わせはありません。";
  if (tab === "done") {
    return period === "recent"
      ? "直近30日以内に対応済みになったお問い合わせはありません。"
      : "30日より前に対応済みになったお問い合わせはありません。";
  }
  return period === "recent"
    ? "直近30日以内のお問い合わせはありません。"
    : "30日より前のお問い合わせはありません。";
}

/** 管理: 大会・お問い合わせ一覧 */
export default async function AdminTournamentInquiriesPage({
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
  let query = supabase
    .from("tournament_inquiries")
    .select(
      "id, created_at, updated_at, status, contact_name, contact_email, contact_phone, message, source_path"
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
  const rows = (data ?? []) as Row[];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">お問い合わせ</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          公開の「お問い合わせ」フォームから届いた内容です。合宿相談（
          <Link
            href="/admin/camp-inquiries"
            className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
          >
            合宿相談
          </Link>
          ）とは別の受付です。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          新着通知は{" "}
          <code className="text-xs">TOURNAMENT_INQUIRY_NOTIFY_EMAIL</code>{" "}
          または{" "}
          <code className="text-xs">OPS_NOTIFY_EMAIL</code>{" "}
          設定時にメールでも届きます（両方未設定時は DB のみ）。
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={inquiryListHref("/admin/tournament-inquiries", "todo", "recent")}
            className={tabClass(tab === "todo")}
            aria-current={tab === "todo" ? "page" : undefined}
          >
            要対応
          </Link>
          <Link
            href={inquiryListHref("/admin/tournament-inquiries", "in_progress", "recent")}
            className={tabClass(tab === "in_progress")}
            aria-current={tab === "in_progress" ? "page" : undefined}
          >
            対応中
          </Link>
          <Link
            href={inquiryListHref("/admin/tournament-inquiries", "done", "recent")}
            className={tabClass(tab === "done")}
            aria-current={tab === "done" ? "page" : undefined}
          >
            対応済み
          </Link>
          <Link
            href={inquiryListHref("/admin/tournament-inquiries", "all", "recent")}
            className={tabClass(tab === "all")}
            aria-current={tab === "all" ? "page" : undefined}
          >
            すべて
          </Link>
        </div>
        {(tab === "done" || tab === "all") && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">受付日時</span>
            <Link
              href={inquiryListHref("/admin/tournament-inquiries", tab, "recent")}
              className={tabClass(period === "recent")}
              aria-current={period === "recent" ? "page" : undefined}
            >
              直近30日
            </Link>
            <Link
              href={inquiryListHref("/admin/tournament-inquiries", tab, "older")}
              className={tabClass(period === "older")}
              aria-current={period === "older" ? "page" : undefined}
            >
              それ以前
            </Link>
          </div>
        )}
        <p className="text-xs leading-relaxed text-zinc-500">
          要対応・対応中はステータスで全期間を表示します。対応済み・すべては受付日時が直近30日以内か、それより前かで切り替えます（いずれも最大200件）。
        </p>
      </div>

      {error ? (
        <p className="wrap-break-word text-sm text-red-600">
          取得に失敗しました: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyMessageTournament(tab, period)}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80"
              >
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">受付</span>{" "}
                  {formatDateTimeTokyoWithWeekday(row.created_at)}
                </p>
                <dl className="mt-3 space-y-2.5 text-sm text-zinc-900">
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">お名前</dt>
                    <dd className="mt-0.5 wrap-break-word">{row.contact_name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">メール</dt>
                    <dd className="mt-0.5 wrap-break-word text-xs sm:text-sm">{row.contact_email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">電話</dt>
                    <dd className="mt-0.5 wrap-break-word font-mono text-xs">
                      {row.contact_phone?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">内容（抜粋）</dt>
                    <dd className="mt-0.5 wrap-break-word text-xs leading-relaxed text-zinc-700 whitespace-pre-wrap">
                      {previewMessage(row.message)}
                    </dd>
                  </div>
                  <div className="border-t border-zinc-100 pt-2">
                    <dt className="text-xs font-medium text-zinc-500">ステータス</dt>
                    <dd className="mt-0.5 font-medium">{campInquiryStatusLabelJa(row.status)}</dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <Link
                    href={`/admin/tournament-inquiries/${row.id}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    詳細
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden min-w-0 max-w-full md:block">
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
              <table className="min-w-[42rem] w-full border-collapse text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 sm:text-sm">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">受付日時</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">お名前</th>
                    <th className="min-w-[12rem] px-3 py-2.5 sm:px-4">メール</th>
                    <th className="min-w-[8rem] px-3 py-2.5 sm:px-4">電話</th>
                    <th className="min-w-[14rem] px-3 py-2.5 sm:px-4">内容（抜粋）</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">ステータス</th>
                    <th className="sticky right-0 z-20 min-w-[6.5rem] whitespace-nowrap border-l border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.12)] sm:px-4">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="group align-top text-zinc-900">
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                        {formatDateTimeTokyoWithWeekday(row.created_at)}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 sm:px-4">
                        {row.contact_name?.trim() || "—"}
                      </td>
                      <td
                        className="max-w-[14rem] truncate px-3 py-2.5 text-xs sm:px-4 sm:text-sm"
                        title={row.contact_email}
                      >
                        {row.contact_email}
                      </td>
                      <td
                        className="max-w-[10rem] truncate px-3 py-2.5 font-mono text-xs sm:px-4 sm:text-sm"
                        title={row.contact_phone?.trim() ?? ""}
                      >
                        {row.contact_phone?.trim() || "—"}
                      </td>
                      <td
                        className="max-w-md px-3 py-2.5 text-xs leading-snug text-zinc-700 sm:px-4 sm:text-sm"
                        title={row.message}
                      >
                        <span className="line-clamp-2 whitespace-pre-wrap">
                          {previewMessage(row.message)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                        {campInquiryStatusLabelJa(row.status)}
                      </td>
                      <td className="sticky right-0 z-10 min-w-[6.5rem] whitespace-nowrap border-l border-zinc-200 bg-white px-2 py-2 shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.12)] group-hover:bg-zinc-50 sm:px-3">
                        <Link
                          href={`/admin/tournament-inquiries/${row.id}`}
                          className="inline-flex min-h-9 w-full min-w-[4.75rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
