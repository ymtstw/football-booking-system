/**
 * パフォーマンス改善後も、集計・availability の意味が変わらないことをモックで検証する。
 * （実 DB は integration、ここではロジックの退行防止）
 */
import { describe, expect, it, vi } from "vitest";

import { buildDashboardEventDaySummaryPayload } from "@/lib/admin/dashboard-event-day-summary";
import { buildPublicAvailabilityPayloadForDay } from "@/lib/event-days/public-availability-for-day";
import type { SupabaseClient } from "@supabase/supabase-js";

/** buildDashboardEventDaySummaryPayload が期待する最小のチェーン */
function createDashboardSummaryMock(opts: {
  reservations: Array<{ id: string; participant_count: number }>;
  matchingWarningCount: number | null;
  failedNotificationCount: number;
  lunchRows: Array<{ item_name_snapshot: string; quantity: number }>;
}): SupabaseClient {
  const matchingRow =
    opts.matchingWarningCount === null
      ? null
      : { warning_count: opts.matchingWarningCount };

  const from = vi.fn((table: string) => {
    if (table === "reservations") {
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.reservations,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "matching_runs") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: matchingRow,
                  error: null,
                }),
            }),
          }),
        }),
      };
    }
    if (table === "notifications") {
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                count: opts.failedNotificationCount,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "reservation_lunch_items") {
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: opts.lunchRows,
              error: null,
            }),
        }),
      };
    }
    throw new Error(`unexpected table in mock: ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

describe("buildDashboardEventDaySummaryPayload（active 件数・participant 合計・failed 件数）", () => {
  const dayRow = {
    id: "day-1",
    event_date: "2026-06-01",
    grade_band: "小学",
    status: "open",
    weather_status: null as string | null,
  };

  it("active チーム数 = active 行数、participant_count は合算、failed は notifications の count", async () => {
    const supabase = createDashboardSummaryMock({
      reservations: [
        { id: "r1", participant_count: 10 },
        { id: "r2", participant_count: 5 },
      ],
      matchingWarningCount: 2,
      failedNotificationCount: 7,
      lunchRows: [],
    });

    const out = await buildDashboardEventDaySummaryPayload(supabase, dayRow);

    expect(out.activeTeamCount).toBe(2);
    expect(out.totalParticipants).toBe(15);
    expect(out.failedForDay).toBe(7);
    expect(out.warningCount).toBe(2);
    expect(out.totalMeals).toBe(0);
    expect(out.lunchByMenu).toEqual([]);
  });

  it("participant_count が不正値のときは 0 として足す（従来どおり Number フォールバック）", async () => {
    const supabase = createDashboardSummaryMock({
      reservations: [{ id: "r1", participant_count: NaN }],
      matchingWarningCount: null,
      failedNotificationCount: 0,
      lunchRows: [],
    });

    const out = await buildDashboardEventDaySummaryPayload(supabase, dayRow);

    expect(out.activeTeamCount).toBe(1);
    expect(out.totalParticipants).toBe(0);
    expect(out.failedForDay).toBe(0);
    expect(out.warningCount).toBeNull();
  });
});

describe("buildPublicAvailabilityPayloadForDay（active 総数・スロット別 activeCount）", () => {
  const day = {
    id: "ed-1",
    event_date: "2026-06-15",
    grade_band: "小学",
    status: "open",
    reservation_deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
  };

  it("activeReservationCount は morning_slot 未選択を含む全 active 件数、スロット集計は slot ありのみ", async () => {
    const slotId = "slot-a";
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "event_day_slots") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: slotId,
                            slot_code: "M1",
                            phase: "morning",
                            start_time: "09:00",
                            end_time: "10:30",
                            capacity: 2,
                            is_locked: false,
                          },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "reservations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        selected_morning_slot_id: null,
                        created_at: "2026-01-01T00:00:00Z",
                        teams: {
                          team_name: "A",
                          strength_category: "strong",
                          representative_grade_year: 4,
                        },
                      },
                      {
                        selected_morning_slot_id: slotId,
                        created_at: "2026-01-02T00:00:00Z",
                        teams: {
                          team_name: "B",
                          strength_category: "potential",
                          representative_grade_year: null,
                        },
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const got = await buildPublicAvailabilityPayloadForDay(supabase, day);
    expect(got.ok).toBe(true);
    if (!got.ok) throw new Error("expected ok");
    expect(got.payload.activeReservationCount).toBe(2);

    const ms = got.payload.morningSlots;
    expect(ms).toHaveLength(1);
    expect(ms[0]?.activeCount).toBe(1);
    expect(ms[0]?.byCategory.strong).toBe(0);
    expect(ms[0]?.byCategory.potential).toBe(1);
    expect(ms[0]?.bookedTeams).toHaveLength(1);
    expect(ms[0]?.bookedTeams[0]?.teamName).toBe("B");
  });
});

describe("管理・予約一覧: eventDayId 行の再利用条件（ページと同じ式）", () => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function canReuseEventDayHeaderFromId(
    effectiveDate: string,
    byIdRow: { event_date: string } | null
  ): boolean {
    return Boolean(
      byIdRow &&
        ISO.test(effectiveDate) &&
        byIdRow.event_date === effectiveDate
    );
  }

  it("effectiveDate が id 行の event_date と一致すれば開催日は日付クエリ不要でよい", () => {
    const row = { event_date: "2026-04-01" };
    expect(canReuseEventDayHeaderFromId("2026-04-01", row)).toBe(true);
    expect(canReuseEventDayHeaderFromId("2026-04-02", row)).toBe(false);
  });

  it("日付形式でなければ再利用しない", () => {
    expect(canReuseEventDayHeaderFromId("invalid", { event_date: "2026-04-01" })).toBe(
      false
    );
  });
});
