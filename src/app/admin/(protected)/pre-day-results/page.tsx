import { PreDayResultsClient } from "./pre-day-results-client";
import { getNearestUpcomingEventDateIso } from "@/lib/admin/nearest-upcoming-event-date";
import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createServiceRoleClient } from "@/lib/supabase/service";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

/** SCR-11 + SCR-12（補正タブ）・通知 failed 表示（`?notifications=failed`） */
export default async function AdminPreDayResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string | string[]; tab?: string | string[]; notifications?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.date;
  const dateStr = typeof raw === "string" ? raw.trim() : "";

  const todayTokyo = tokyoIsoDateToday();
  let fallbackDate = todayTokyo;
  try {
    const supabase = createServiceRoleClient();
    const nearest = await getNearestUpcomingEventDateIso(supabase, todayTokyo);
    if (nearest) fallbackDate = nearest;
  } catch {
    /* 取得失敗時は今日の日付で表示（クライアント側で matches API エラーになり得る） */
  }

  /** `?date=` が無いときは東京の「今日以降で最も近い開催日」（当日があれば当日） */
  const initialDate = dateStr && isIsoDateOnly(dateStr) ? dateStr : fallbackDate;

  const rawTab = sp.tab;
  const tabStr = typeof rawTab === "string" ? rawTab.trim() : "";
  const initialTab = tabStr === "adjust" ? ("adjust" as const) : ("matches" as const);

  const rawNotif = sp.notifications;
  const notifStr = typeof rawNotif === "string" ? rawNotif.trim() : "";
  const initialNotificationsFocus = notifStr === "failed" ? ("failed" as const) : null;

  return (
    <PreDayResultsClient
      initialDate={initialDate}
      initialTab={initialTab}
      initialNotificationsFocus={initialNotificationsFocus}
    />
  );
}
