/**
 * failed の通知を再送（pending に戻してから既存の送信関数を実行）。
 */
import { NextResponse } from "next/server";

import { retryFailedNotificationById } from "@/lib/admin/notification-retry";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "id（UUID）が必要です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const result = await retryFailedNotificationById(supabase, id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }

  return NextResponse.json({
    ok: true,
    notificationId: id,
    status: result.status,
  });
}
