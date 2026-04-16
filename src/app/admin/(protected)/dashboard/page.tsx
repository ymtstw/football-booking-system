/** SCR-10: 直近1件の開催日サマリ＋任意で次の開催を連続表示（昼食・人数・状態・通知 failed） */
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardUpcomingChain } from "./dashboard-upcoming-chain";
import { buildDashboardEventDaySummaryPayload } from "@/lib/admin/dashboard-event-day-summary";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { addDaysIsoDate, tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

type NextEventDayRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  weather_status: string | null;
};

export default async function AdminDashboardPage() {
  if (!(await getAdminUser())) {
    redirect("/admin/login");
  }

  const todayTokyo = tokyoIsoDateToday();
  const tomorrowTokyo = addDaysIsoDate(todayTokyo, 1);
  const supabase = createServiceRoleClient();

  /** 今日（東京）以降で event_date が最も早い開催日を 1 件だけ */
  const { data: dayRaw, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, weather_status")
    .gte("event_date", todayTokyo)
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dayErr) {
    return (
      <div className="min-w-0 space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">ダッシュボード</h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          開催日の取得に失敗しました: {dayErr.message}
        </p>
      </div>
    );
  }

  const nextEventDay = dayRaw as NextEventDayRow | null;

  const initialSummary = nextEventDay
    ? await buildDashboardEventDaySummaryPayload(supabase, nextEventDay)
    : null;

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">ダッシュボード</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600">
          今日（東京）以降で最も近い開催日を<strong className="font-medium">1件</strong>
          表示し、来場チーム数・昼食・参加人数・状態を確認できます。
          <strong className="font-medium">「次の開催日を読み込む」</strong>
          で、その次に登録されている開催日を同じ形式で足していけます（数日分の昼食数の把握用）。一覧や別日は開催日管理・前日確定を利用してください。
        </p>
      </div>

      {!nextEventDay || !initialSummary ? (
        <section
          aria-labelledby="dash-no-upcoming"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-700"
        >
          <h2 id="dash-no-upcoming" className="text-sm font-semibold text-zinc-900">
            直近の開催
          </h2>
          <p className="mt-2">
            {formatIsoDateWithWeekdayJa(todayTokyo)} 以降に登録された開催日はまだありません。
          </p>
          <Link
            href="/admin/event-days"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            開催日管理へ
          </Link>
        </section>
      ) : (
        <DashboardUpcomingChain
          todayTokyo={todayTokyo}
          tomorrowTokyo={tomorrowTokyo}
          initialDay={initialSummary}
        />
      )}

      <footer className="border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
        運用手順:{" "}
        <span className="font-mono text-[11px]">docs/ops/mvp-day-before-runbook.md</span>
        {" · "}
        本番チェック:{" "}
        <span className="font-mono text-[11px]">docs/ops/vercel-production-checklist.md</span>
      </footer>
    </div>
  );
}
