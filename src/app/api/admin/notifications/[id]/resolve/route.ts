import { NextResponse } from "next/server";

import {
  ADMIN_API_READ_ERROR_JA,
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  note?: string;
};

/**
 * 運用: 送信エラー（failed）を「対応済み」として畳む。
 * - status は履歴として保持（failed の事実は残す）
 * - UI は `status=failed AND resolved_at IS NULL` のみを「要対応」とする
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "id（UUID）が必要です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const body = json as Body;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null;

  const supabase = createServiceRoleClient();

  const { data: before, error: fetchErr } = await supabase
    .from("notifications")
    .select("id, status, resolved_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    logAdminApiDbError("POST notifications/[id]/resolve fetch", fetchErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: "通知が見つかりません" }, { status: 404 });
  }
  const st = String((before as { status?: string }).status ?? "");
  if (st !== "failed") {
    return NextResponse.json(
      { error: "対応済みにできるのは status が failed の通知のみです" },
      { status: 409 }
    );
  }
  const alreadyResolved =
    (before as { resolved_at?: string | null }).resolved_at != null;
  if (alreadyResolved) {
    return NextResponse.json(
      {
        error:
          "この送信エラーは、すでに対応済みとして記録されています。最新の一覧を表示しました。",
      },
      { status: 409 }
    );
  }

  const { error: upErr } = await supabase
    .from("notifications")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
      resolved_note: note,
    })
    .eq("id", id)
    .eq("status", "failed")
    .is("resolved_at", null);

  if (upErr) {
    logAdminApiDbError("POST notifications/[id]/resolve update", upErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notificationId: id, resolved: true });
}

/** 対応済み取り消し（運用が間違っていた場合の戻し） */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "id（UUID）が必要です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error: upErr } = await supabase
    .from("notifications")
    .update({
      resolved_at: null,
      resolved_by: null,
      resolved_note: null,
    })
    .eq("id", id)
    .eq("status", "failed");

  if (upErr) {
    logAdminApiDbError("DELETE notifications/[id]/resolve update", upErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notificationId: id, resolved: false });
}

