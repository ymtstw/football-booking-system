import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { isCampInquiryStatus } from "@/lib/camp-inquiry/camp-inquiry-status";
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

  const status = (body as { status?: unknown }).status;
  if (typeof status !== "string" || !isCampInquiryStatus(status)) {
    return NextResponse.json(
      { error: "status は new / in_progress / done のいずれかです" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("camp_inquiries")
    .update({ status })
    .eq("id", id)
    .select("id, status, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "更新に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...data });
}
