/**
 * 開催日一覧（カレンダー・日付選択）の読み取りキャッシュ。
 * 全管理者で共通の内容なのでサービスロールで取得し 60 秒キャッシュする。
 * 目的: よく開く管理画面（開催日一覧・予約一覧）の大きな取得を減らし Disk IO を抑える。
 *
 * 無効化: 開催日の作成・公開/非公開・締切ロック・削除で revalidateTag(EVENT_DAYS_TAG)。
 * それ以外の状態変更（天候・運営中止・Cron ロック）は 60 秒で自己回復する。
 */
import "server-only";

import { unstable_cache } from "next/cache";

import { ADMIN_EVENT_DAY_CALENDAR_MAX } from "@/lib/admin/event-day-list-limits";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** 開催日キャッシュの無効化タグ */
export const EVENT_DAYS_TAG = "admin-event-days";

const EVENT_DAYS_TTL_SECONDS = 60;

/** 予約一覧の日付ドロップダウン取得上限（従来値と同じ） */
const DATE_OPTIONS_LIMIT = 400;

export type EventDayCalendarRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
};

/** 開催日一覧のカレンダー用（最大 2000 件・60秒キャッシュ） */
export const getEventDaysCalendarCached = unstable_cache(
  async (): Promise<{ rows: EventDayCalendarRow[]; error: string | null }> => {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("event_days")
      .select("id, event_date, grade_band, status")
      .order("event_date", { ascending: true })
      .limit(ADMIN_EVENT_DAY_CALENDAR_MAX);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as EventDayCalendarRow[], error: null };
  },
  ["admin-event-days-calendar"],
  { revalidate: EVENT_DAYS_TTL_SECONDS, tags: [EVENT_DAYS_TAG] }
);

/** 予約一覧の日付選択用（event_date のみ・60秒キャッシュ）。消費側の分割代入に合わせ { data, error } 形で返す */
export const getEventDaysDateOptionsCached = unstable_cache(
  async (): Promise<{ data: { event_date: string }[]; error: string | null }> => {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("event_days")
      .select("event_date")
      .order("event_date", { ascending: true })
      .limit(DATE_OPTIONS_LIMIT);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as { event_date: string }[], error: null };
  },
  ["admin-event-days-date-options"],
  { revalidate: EVENT_DAYS_TTL_SECONDS, tags: [EVENT_DAYS_TAG] }
);
