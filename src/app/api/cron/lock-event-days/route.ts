/**
 * Cron JOB01: 予約締切を過ぎた `open` 開催日を処理する。
 *
 * - active が 3 未満: `cancelled_minimum` と最少催行の即時メール
 * - それ以外: `locked`（続けて JOB02 で編成）
 *
 * **Vercel Cron** は `vercel.json` の `0 6 * * *`（UTC 06:00 = **15:00 JST**）想定。
 * 認証: `CRON_SECRET`。
 */
import { type NextRequest, NextResponse } from "next/server";

import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { processReservationDeadlinePassed } from "@/lib/event-days/process-reservation-deadline";
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
    return NextResponse.json({
      ok: true,
      minimumCancelledCount: minimumCancelledIds.length,
      minimumCancelledIds,
      lockedCount: lockedIds.length,
      lockedIds,
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
