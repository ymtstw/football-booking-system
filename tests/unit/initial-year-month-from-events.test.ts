import { describe, expect, it } from "vitest";

import {
  initialYearMonthFromEvents,
  tokyoYearMonthNow,
} from "@/lib/dates/tokyo-calendar-grid";

describe("initialYearMonthFromEvents", () => {
  it("notBeforeIsoDate 未指定の場合は、一覧内の最古日付の年月を返す", () => {
    expect(initialYearMonthFromEvents(["2026-06-01", "2026-04-15", "2026-05-01"])).toEqual({
      year: 2026,
      month: 4,
    });
  });

  it("notBeforeIsoDate 指定時は、その日付より前の開催日を無視する", () => {
    expect(
      initialYearMonthFromEvents(["2026-04-01", "2026-04-30", "2026-05-15", "2026-06-01"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual({ year: 2026, month: 5 });
  });

  it("notBeforeIsoDate と同日の開催日は対象に含める", () => {
    expect(
      initialYearMonthFromEvents(["2026-04-01", "2026-05-01"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual({ year: 2026, month: 5 });
    expect(
      initialYearMonthFromEvents(["2026-05-01"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual({ year: 2026, month: 5 });
  });

  it("指定日以降の開催日が複数ある場合、最も早い開催日の年月を返す", () => {
    expect(
      initialYearMonthFromEvents(["2026-07-01", "2026-05-20", "2026-06-10"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual({ year: 2026, month: 5 });
  });

  it("指定日以降の開催日がない場合、tokyoYearMonthNow() にフォールバックする", () => {
    /** 同一モジュール内参照のため spy が効かない。実装と同じ `tokyoYearMonthNow()` と一致することを検証する。 */
    const expected = tokyoYearMonthNow();
    expect(
      initialYearMonthFromEvents(["2026-04-01", "2026-04-28"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual(expected);
  });

  it("一覧が空の場合も tokyoYearMonthNow() にフォールバックする（従来どおり）", () => {
    expect(initialYearMonthFromEvents([])).toEqual(tokyoYearMonthNow());
  });

  it("不正な日付文字列は除外される", () => {
    expect(initialYearMonthFromEvents(["not-a-date", "2026-05-01", "2026-04-01"])).toEqual({
      year: 2026,
      month: 4,
    });
    expect(
      initialYearMonthFromEvents(["bad", "xxxxx", "2026-06-01"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual({ year: 2026, month: 6 });
    expect(
      initialYearMonthFromEvents(["invalid", "also-bad"], {
        notBeforeIsoDate: "2026-05-01",
      })
    ).toEqual(tokyoYearMonthNow());
  });

  it("schedule-hub-client 相当（本日以降のみ・notBefore 未指定）と、全件+notBefore で初期月が一致する", () => {
    const today = "2026-05-09";
    const allEventDates = ["2026-04-01", "2026-04-20", "2026-05-09", "2026-05-10", "2026-06-01"];
    const upcomingOnly = allEventDates.filter((d) => d >= today);
    const fromHubStyle = initialYearMonthFromEvents(upcomingOnly);
    const fromReserveStyle = initialYearMonthFromEvents(allEventDates, {
      notBeforeIsoDate: today,
    });
    expect(fromHubStyle).toEqual(fromReserveStyle);
    expect(fromHubStyle).toEqual({ year: 2026, month: 5 });
  });
});
