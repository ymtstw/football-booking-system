/** SCR-10: 直近1件の開催日サマリ＋任意で次の開催を連続表示（昼食・人数・状態・通知 failed） */
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardAroundBar } from "./dashboard-around-bar";
import { DashboardUpcomingChain } from "./dashboard-upcoming-chain";
import type { DashboardEventDaySummaryPayload } from "@/lib/admin/dashboard-event-day-summary.types";
import { buildDashboardEventDaySummaryPayload } from "@/lib/admin/dashboard-event-day-summary";
import { parseAroundParam } from "@/lib/admin/parse-around-param";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ around?: string | string[] | undefined }>;
}) {
  if (!(await getAdminUser())) {
    redirect("/admin/login");
  }

  const sp = searchParams ? await searchParams : {};
  const aroundFromUrl = parseAroundParam(sp.around);
  const explicitAround = aroundFromUrl !== null;
  const anchorEventDate = aroundFromUrl ?? tokyoIsoDateToday();

  const todayTokyo = tokyoIsoDateToday();
  const tomorrowTokyo = addDaysIsoDate(todayTokyo, 1);
  const supabase = await createClient();

  /** 基準日以降で最も早い開催日を1クエリで取得し、運営まとめと同じ集計でサマリを構築（event_days の二重取得を避ける） */
  const { data: dayRow, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, weather_status")
    .gte("event_date", anchorEventDate)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dayErr) {
    return (
      <div className="min-w-0 space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">直近の開催日</h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          開催日の情報を表示できませんでした。時間をおいて再度お試しください。
        </p>
      </div>
    );
  }

  let initialSummary: DashboardEventDaySummaryPayload | null = null;
  if (dayRow?.id) {
    try {
      initialSummary = await buildDashboardEventDaySummaryPayload(supabase, dayRow);
    } catch {
      return (
        <div className="min-w-0 space-y-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">直近の開催日</h1>
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            開催日のサマリを表示できませんでした。時間をおいて再度お試しください。
          </p>
        </div>
      );
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-md ring-1 ring-zinc-100 sm:p-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-700"
          aria-hidden
        />
        <div className="relative pl-4 sm:pl-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">運営</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            直近の開催日
          </h1>
          <p className="mt-2 max-w-2xl border-t border-zinc-100 pt-3 text-sm leading-relaxed text-zinc-600">
            予約数・昼食・試合表の状態・天候・メール送信エラーなど、この日の運営に必要な情報を一覧します。基準日は下のバーで変更できます。
          </p>
        </div>
      </header>

      {!initialSummary ? (
        <section
          aria-labelledby="dash-no-upcoming"
          className="space-y-4 rounded-xl border border-zinc-200/90 bg-white px-4 py-6 text-sm text-zinc-700 shadow-sm ring-1 ring-zinc-100 sm:px-6"
        >
          <DashboardAroundBar anchorEventDate={anchorEventDate} explicitAround={explicitAround} />
          <h2 id="dash-no-upcoming" className="text-sm font-semibold text-zinc-900">
            直近の開催
          </h2>
          <p className="mt-2">
            {formatIsoDateWithWeekdayJa(anchorEventDate)} 以降に登録された開催日はまだありません。
          </p>
          <Link
            href="/admin/event-days"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            開催日一覧へ
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          <DashboardAroundBar anchorEventDate={anchorEventDate} explicitAround={explicitAround} />
          <DashboardUpcomingChain
            key={`${anchorEventDate}-${initialSummary.id}`}
            todayTokyo={todayTokyo}
            tomorrowTokyo={tomorrowTokyo}
            initialDay={initialSummary}
          />
        </div>
      )}
    </div>
  );
}
