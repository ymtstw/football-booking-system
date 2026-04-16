/**
 * Cron JOB02: `locked` な開催日に対し午前補完・午後一括編成を順に実行。
 *
 * スケジュール: `vercel.json` の `1 6 * * *`（UTC 06:01 = 同日 15:01 JST・締切直後）。
 * 認証は `GET /api/cron/lock-event-days` と同じ（`CRON_SECRET`）。
 */
import { type NextRequest, NextResponse } from "next/server";

import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { applyMatchingForEventDayId } from "@/lib/matching/run-matching-for-event-day";
import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = cronSecretConfigured();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET が未設定か短すぎます（16 文字以上）。ローカルなら .env.local に設定し dev を再起動。本番・Preview は Vercel の Environment Variables に登録してください。",
      },
      { status: 503 }
    );
  }

  if (!authorizeCronBearer(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const todayTokyo = tokyoIsoDateToday();

  const { data: lockedDays, error: listErr } = await supabase
    .from("event_days")
    .select("id, event_date")
    .eq("status", "locked")
    .gte("event_date", todayTokyo);

  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 });
  }

  const results: {
    eventDayId: string;
    eventDate: string;
    ok: boolean;
    skipped?: string;
    matchingRunId?: string;
    assignmentCount?: number;
    error?: string;
  }[] = [];

  for (const row of lockedDays ?? []) {
    const id = row.id as string;
    const eventDate = row.event_date as string;
    try {
      const applied = await applyMatchingForEventDayId(supabase, id);
      if (!applied.ok) {
        if (applied.error === "already_matched" || applied.error === "not_locked") {
          results.push({
            eventDayId: id,
            eventDate,
            ok: true,
            skipped: applied.message,
          });
          continue;
        }
        results.push({
          eventDayId: id,
          eventDate,
          ok: false,
          error: applied.message,
        });
        continue;
      }
      results.push({
        eventDayId: id,
        eventDate,
        ok: true,
        matchingRunId: applied.matchingRunId,
        assignmentCount: applied.assignmentCount,
      });
    } catch (e) {
      results.push({
        eventDayId: id,
        eventDate,
        ok: false,
        error: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    todayTokyo,
    processed: results.length,
    results,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
