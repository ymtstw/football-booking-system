import { NextResponse } from "next/server";

import {
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { appendInternalNoteToPatchIfPresent } from "@/lib/admin/inquiry-internal-note-api";
import { getAdminUser } from "@/lib/auth/require-admin";
import {
  CAMP_INQUIRY_STATUS_VALUES_HINT,
  isCampInquiryStatus,
} from "@/lib/camp-inquiry/camp-inquiry-status";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 管理: 合宿相談のステータス更新（手動運用） */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID が不正です" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const hasStatus = Object.prototype.hasOwnProperty.call(b, "status");
  const patch: Record<string, unknown> = {};

  if (hasStatus) {
    const status = b.status;
    if (typeof status !== "string" || !isCampInquiryStatus(status)) {
      return NextResponse.json(
        { error: `status は次のいずれかです: ${CAMP_INQUIRY_STATUS_VALUES_HINT}` },
        { status: 422 }
      );
    }
    patch.status = status;
  }

  const noteResult = appendInternalNoteToPatchIfPresent(b, patch);
  if (!noteResult.ok) {
    return NextResponse.json({ error: noteResult.error }, { status: 422 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "status または internal_note を指定してください" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("camp_inquiries")
    .update(patch)
    .eq("id", id)
    .select("id, status, updated_at, internal_note")
    .single();

  if (error) {
    logAdminApiDbError("PATCH camp-inquiries/[id] update", error);
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "合宿相談が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "合宿相談が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...data });
}
