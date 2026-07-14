/**
 * 公開予約ページ（カレンダー・開催確認ハブ・指定日の空き）の読み取りキャッシュ。
 * 目的: 匿名アクセスのたびに走る開催日一覧・空き集計の DB 往復を減らし Disk IO を抑える。
 *
 * 重要:
 * - **表示のみ**をキャッシュする。予約確定・変更・取消（RPC）は一切キャッシュしない。
 *   定員・締切・重複は確定時に RPC が行ロック付きで再検証するため、表示が最大 TTL 古くても
 *   満枠への予約は確定時に弾かれ、データ不整合は起きない。
 * - **時刻依存の値（受付可否・締切超過・bookable）はキャッシュに含めない**。DB 行だけをキャッシュし、
 *   受付可否は呼び出し側が `Date.now()` で都度算出する（下の各ローダー参照）。
 *
 * 無効化: `PUBLIC_RESERVE_TAG`（予約作成・取消）と `EVENT_DAYS_TAG`（開催日の状態変更・既存経路を再利用）。
 */
import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { EVENT_DAYS_TAG } from "@/lib/admin/event-days-cache";
import {
  buildPublicAvailabilityPayloadForDay,
  type PublicAvailabilityDayRow,
  type PublicAvailabilityPayload,
} from "@/lib/event-days/public-availability-for-day";
import { sumMorningRemainingVacanciesByEventDay } from "@/lib/event-days/morning-remaining-vacancies";
import { publicEventDayStatuses } from "@/lib/event-days/public-schedule-for-day";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** 公開予約キャッシュの無効化タグ（予約作成・取消で無効化） */
export const PUBLIC_RESERVE_TAG = "public-reserve";

/** 一覧は変化が緩いので 60 秒 */
const LIST_TTL_SECONDS = 60;
/** 空きは残数が動くので短め 30 秒（＋予約書き込みで即時無効化） */
const AVAILABILITY_TTL_SECONDS = 30;

/** 公開カレンダー・ハブの一覧に出す開催日ステータス（従来の一覧と同一） */
const PUBLIC_LIST_STATUSES = [
  "open",
  "locked",
  "confirmed",
  "cancelled_weather",
  "cancelled_operational",
  "cancelled_minimum",
] as const;

export type PublicEventDayRawRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at: string;
  matching_proposal_notice_sent_at: string | null;
  max_teams: number;
};

export type PublicEventDaysRawData = {
  rows: PublicEventDayRawRow[];
  /** 朝枠の残数合計（開催日ID→残数） */
  vacancyByEventDayId: Record<string, number>;
  /** 有効予約（チーム）数（開催日ID→件数） */
  activeCountByEventDayId: Record<string, number>;
};

/**
 * 一覧の生データ（開催日行＋残数＋有効件数）を 60 秒キャッシュ。
 * 受付可否などの時刻判定は含めない（呼び出し側で算出）。
 */
export const getPublicEventDaysRawCached = unstable_cache(
  async (): Promise<
    | { ok: true; data: PublicEventDaysRawData }
    | { ok: false; message: string; code?: string }
  > => {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("event_days")
      .select(
        "id, event_date, grade_band, status, reservation_deadline_at, matching_proposal_notice_sent_at, max_teams"
      )
      .in("status", [...PUBLIC_LIST_STATUSES])
      .order("event_date", { ascending: true });

    if (error) {
      logPublicReserveApiSupabaseError("getPublicEventDaysRawCached event_days", error);
      return { ok: false, message: PUBLIC_RESERVE_API_READ_ERROR_JA, code: error.code };
    }

    const rows = (data ?? []).map((r) => ({
      id: String(r.id),
      event_date: String(r.event_date),
      grade_band: String(r.grade_band),
      status: String(r.status),
      reservation_deadline_at: String(r.reservation_deadline_at),
      matching_proposal_notice_sent_at:
        (r as { matching_proposal_notice_sent_at?: string | null })
          .matching_proposal_notice_sent_at ?? null,
      max_teams:
        typeof (r as { max_teams?: number }).max_teams === "number"
          ? (r as { max_teams: number }).max_teams
          : 4,
    })) as PublicEventDayRawRow[];

    const eventDayIds = rows.map((r) => r.id);

    const vacancyMap = await sumMorningRemainingVacanciesByEventDay(supabase, eventDayIds);

    const activeCountByEventDayId: Record<string, number> = {};
    if (eventDayIds.length > 0) {
      const { data: resCountRows, error: resCountErr } = await supabase
        .from("reservations")
        .select("event_day_id")
        .in("event_day_id", eventDayIds)
        .eq("status", "active");
      if (!resCountErr && Array.isArray(resCountRows)) {
        for (const r of resCountRows) {
          const id = String((r as { event_day_id: string }).event_day_id);
          activeCountByEventDayId[id] = (activeCountByEventDayId[id] ?? 0) + 1;
        }
      }
    }

    const vacancyByEventDayId: Record<string, number> = {};
    for (const row of rows) {
      const active = activeCountByEventDayId[row.id] ?? 0;
      const slotVacancy = vacancyMap.get(row.id) ?? 0;
      const teamVacancy = Math.max(0, row.max_teams - active);
      vacancyByEventDayId[row.id] = Math.min(slotVacancy, teamVacancy);
    }

    return { ok: true, data: { rows, vacancyByEventDayId, activeCountByEventDayId } };
  },
  ["public-event-days-raw"],
  { revalidate: LIST_TTL_SECONDS, tags: [PUBLIC_RESERVE_TAG, EVENT_DAYS_TAG] }
);

export type PublicAvailabilityCachedResult =
  | { ok: true; payload: PublicAvailabilityPayload }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "error"; message: string };

/**
 * 指定日の空きペイロードを 30 秒キャッシュ。
 * ペイロードに含まれる受付可否・bookable は呼び出し側で都度上書きする（`deriveFreshAvailabilityAcceptance`）。
 */
export const getPublicAvailabilityCached = unstable_cache(
  async (eventDate: string): Promise<PublicAvailabilityCachedResult> => {
    const supabase = createServiceRoleClient();
    const { data: day, error } = await supabase
      .from("event_days")
      .select(
        "id, event_date, grade_band, status, reservation_deadline_at, matching_proposal_notice_sent_at, max_teams"
      )
      .eq("event_date", eventDate)
      .in("status", [...publicEventDayStatuses()])
      .maybeSingle();

    if (error) {
      logPublicReserveApiSupabaseError(
        `getPublicAvailabilityCached event_days (${eventDate})`,
        error
      );
      return { ok: false, kind: "error", message: PUBLIC_RESERVE_API_READ_ERROR_JA };
    }
    if (!day) {
      return { ok: false, kind: "not_found" };
    }

    const built = await buildPublicAvailabilityPayloadForDay(
      supabase,
      day as PublicAvailabilityDayRow
    );
    if (!built.ok) {
      return { ok: false, kind: "error", message: built.message };
    }
    return { ok: true, payload: built.payload };
  },
  ["public-availability"],
  { revalidate: AVAILABILITY_TTL_SECONDS, tags: [PUBLIC_RESERVE_TAG, EVENT_DAYS_TAG] }
);

/**
 * キャッシュ済みペイロードの時刻依存フィールド（受付可否・各枠 bookable）を現在時刻で上書きする。
 * status / 残数 / 満枠(full) はデータなのでキャッシュ値をそのまま使う。
 */
export function deriveFreshAvailabilityAcceptance(
  payload: PublicAvailabilityPayload
): PublicAvailabilityPayload {
  const deadline = new Date(payload.reservationDeadlineAt).getTime();
  const accepting =
    payload.eventDayStatus === "open" &&
    Number.isFinite(deadline) &&
    Date.now() < deadline;

  return {
    ...payload,
    acceptingReservations: accepting,
    morningSlots: payload.morningSlots.map((s) => ({
      ...s,
      bookable:
        payload.eventDayStatus === "open" && accepting && !s.isLocked && !s.full,
    })),
  };
}

/**
 * 公開表示（予約一覧・空き状況）のキャッシュを無効化する。
 * 空き状況に影響する書き込みは必ずこのヘルパーを呼ぶこと。
 * 例: 予約作成・取消、枠の編集・追加（強制含む）。
 * ※開催日 status の変更は EVENT_DAYS_TAG 側で無効化されるため別途不要。
 */
export function revalidatePublicReserveCaches(): void {
  revalidateTag(PUBLIC_RESERVE_TAG, "max");
}
