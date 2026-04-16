/**
 * Cron: 締切を過ぎた `open` 開催日を `locked` に一括更新。
 *
 * **Vercel Cron** はこの Route に **GET** を送る（`vercel.json` の `crons`）。
 * スケジュール式は **UTC**。`0 3 * * *` = 毎日 03:00 UTC = **12:00（同日）Asia/Tokyo**。
 *
 * **認証:** 環境変数 `CRON_SECRET` を Vercel に登録すると、Vercel が
 * `Authorization: Bearer <CRON_SECRET>` を付与する（公式ドキュメント準拠）。
 * 手動検証は `curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/lock-event-days`
 * または POST（同じ認証）。
 *
 * **対象:** `status = 'open'` かつ `reservation_deadline_at <= now()`（予約 RPC の締切判定と揃える）。
 *
 * 仕様の文脈: `docs/spec/reservation-deadline-and-event-status.md`
 */
import { type NextRequest, NextResponse } from "next/server";

import { authorizeCronBearer, cronSecretConfigured } from "@/lib/cron/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

async function lockDeadlinePassedOpenDays(): Promise<{
  updatedCount: number;
  updatedIds: string[];
}> {
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("event_days")
    .update({ status: "locked" })
    .eq("status", "open")
    .lte("reservation_deadline_at", nowIso)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  return {
    updatedCount: rows.length,
    updatedIds: rows.map((r) => r.id),
  };
}

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

  try {
    const { updatedCount, updatedIds } = await lockDeadlinePassedOpenDays();
    return NextResponse.json({
      ok: true,
      updatedCount,
      updatedIds,
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
