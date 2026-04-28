/**
 * 管理者のみ: 開催日の運営メモ（event_days.notes）を更新
 */
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

const MAX_NOTES_LEN = 8000;

type PatchBody = {
  notes?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "開催日IDが不正です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const body = json as PatchBody;
  if (!("notes" in body)) {
    return NextResponse.json({ error: "notes を指定してください" }, { status: 400 });
  }

  const raw = body.notes;
  let stored: string | null;
  if (raw === null || raw === undefined) {
    stored = null;
  } else if (typeof raw === "string") {
    const t = raw.trim();
    if (t.length > MAX_NOTES_LEN) {
      return NextResponse.json(
        { error: `メモは ${MAX_NOTES_LEN} 文字以内にしてください` },
        { status: 422 }
      );
    }
    stored = t.length === 0 ? null : t;
  } else {
    return NextResponse.json({ error: "notes は文字列または null です" }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchErr } = await supabase
    .from("event_days")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    logAdminApiDbError("PATCH notes event_days fetch", fetchErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const { data: updated, error: upErr } = await supabase
    .from("event_days")
    .update({ notes: stored })
    .eq("id", id)
    .select("id, notes")
    .maybeSingle();

  if (upErr) {
    logAdminApiDbError("PATCH notes event_days update", upErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "更新できませんでした" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    notes: (updated as { notes: string | null }).notes ?? null,
  });
}
