/**
 * ダッシュボード: 指定日より後の、登録上いちばん近い開催日のサマリを 1 件返す（昼食数の連続確認用）
 */
import { NextRequest, NextResponse } from "next/server";

import {
  getNextDashboardEventDaySummaryAfter,
  isValidIsoDateParam,
} from "@/lib/admin/dashboard-event-day-summary";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const after = request.nextUrl.searchParams.get("after")?.trim() ?? "";
  if (!after || !isValidIsoDateParam(after)) {
    return NextResponse.json(
      { error: "クエリ after（YYYY-MM-DD）が必要です" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const day = await getNextDashboardEventDaySummaryAfter(supabase, after);
    return NextResponse.json({ day });
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
