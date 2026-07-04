/**
 * 公開 GET: 指定日の開催日（open / locked / confirmed / 中止系）について、午前各枠の集計。認証不要。
 * 新規予約は status=open かつ締切前のみ（仕様: docs/spec/implemented-behavior-catalog.md §1）。
 * 表示は SSR と同じ `loadPublicAvailabilityByEventDate`（30秒キャッシュ）経由。確定処理はキャッシュしない。
 */
import { NextResponse } from "next/server";

import { loadPublicAvailabilityByEventDate } from "@/lib/event-days/load-public-availability-by-date";
import { PUBLIC_RESERVE_API_READ_ERROR_JA } from "@/lib/http/public-reserve-api-error";

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> }
) {
  const { date: dateParam } = await context.params;
  const eventDate = decodeURIComponent(dateParam ?? "").trim();

  if (!eventDate || !isIsoDateOnly(eventDate)) {
    return NextResponse.json(
      { error: "date は YYYY-MM-DD で指定してください" },
      { status: 400 }
    );
  }

  const result = await loadPublicAvailabilityByEventDate(eventDate);
  if (!result.ok) {
    if (result.notFound) {
      return NextResponse.json(
        { error: "開催日が見つからないか、予約画面では表示していません" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: result.error || PUBLIC_RESERVE_API_READ_ERROR_JA },
      { status: 500 }
    );
  }

  return NextResponse.json(result.payload);
}
