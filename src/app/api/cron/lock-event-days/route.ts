/**
 * Cron JOB01: 予約締切を過ぎた `open` 開催日を処理する。
 *
 * - active が 3 未満: `cancelled_minimum` と最少催行の即時メール
 * - それ以外: `locked` にし、**同一リクエスト内で**その開催日に対し自動編成（JOB02 と同じ処理）を試みる
 *
 * **Vercel Cron** は `vercel.json` の `0 6 * * *`（UTC 06:00 = **15:00 JST**）想定。
 * 自動編成専用の Vercel Cron（旧 JOB02）は廃止。`/api/cron/run-matching-locked` は手動・スクリプト用に残す。
 * 認証: `CRON_SECRET`。
 */
import { type NextRequest, NextResponse } from "next/server";

import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { processReservationDeadlinePassed } from "@/lib/event-days/process-reservation-deadline";
import { applyMatchingForEventDayId } from "@/lib/matching/run-matching-for-event-day";
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
  const nowIso = new Date().toISOString();

  try {
    const { minimumCancelledIds, lockedIds } =
      await processReservationDeadlinePassed(supabase, nowIso);

    const matchingAfterLock: {
      eventDayId: string;
      ok: boolean;
      matchingRunId?: string;
      assignmentCount?: number;
      skipped?: string;
      error?: string;
    }[] = [];

    for (const id of lockedIds) {
      try {
        const applied = await applyMatchingForEventDayId(supabase, id);
        if (!applied.ok) {
          if (applied.error === "already_matched" || applied.error === "not_locked") {
            matchingAfterLock.push({
              eventDayId: id,
              ok: true,
              skipped: applied.message,
            });
          } else {
            matchingAfterLock.push({
              eventDayId: id,
              ok: false,
              error: applied.message,
            });
          }
          continue;
        }
        matchingAfterLock.push({
          eventDayId: id,
          ok: true,
          matchingRunId: applied.matchingRunId,
          assignmentCount: applied.assignmentCount,
        });
      } catch (e) {
        matchingAfterLock.push({
          eventDayId: id,
          ok: false,
          error: e instanceof Error ? e.message : "unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      minimumCancelledCount: minimumCancelledIds.length,
      minimumCancelledIds,
      lockedCount: lockedIds.length,
      lockedIds,
      matchingAfterLock,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** 手動・CI からの実行用（認証は GET と同じ）。Vercel Cron 本体は GET。 */
export async function POST(request: NextRequest) {
  return GET(request);
}
