/**
 * 公開 GET: 一般カレンダーに載せる開催日（中止系を含む公開可能ステータス）。
 * 予約受付可能かは acceptingReservations（status が open かつ締切が未来）。
 * 仕様: docs/spec/implemented-behavior-catalog.md §1
 */
import { NextResponse } from "next/server";

import { loadPublicEventDaysList } from "@/lib/event-days/load-public-event-days-list";

/**
 * 公開用: 下書き以外の主要ステータスを返す。個人情報・notes は含めない。
 */
export async function GET() {
  const result = await loadPublicEventDaysList();
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  return NextResponse.json({ eventDays: result.eventDays });
}
