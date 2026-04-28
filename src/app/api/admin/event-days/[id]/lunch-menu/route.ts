import { NextResponse } from "next/server";

import {
  ADMIN_API_READ_ERROR_JA,
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import {
  countGloballyActiveLunchMenus,
  CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
  MIN_ACTIVE_LUNCH_MENUS,
} from "@/lib/lunch/admin-lunch-constraints";
import { fetchEffectiveLunchMenuItemsForEventDay } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MasterRow = {
  id: string;
  name: string;
  description: string | null;
  price_tax_included: number;
  is_active: boolean;
  sort_order: number;
};

/** 管理者: 開催日の昼食（グローバル既定 or この日専用） */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: eventDayId } = await context.params;
  if (!eventDayId || !UUID_RE.test(eventDayId)) {
    return NextResponse.json({ error: "開催日IDが不正です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: day, error: dErr } = await supabase
    .from("event_days")
    .select("id, event_date")
    .eq("id", eventDayId)
    .maybeSingle();

  if (dErr) {
    logAdminApiDbError("GET lunch-menu event_days", dErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!day) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const { data: overrides, error: oErr } = await supabase
    .from("event_day_lunch_menu_items")
    .select("lunch_menu_item_id, sort_order")
    .eq("event_day_id", eventDayId)
    .order("sort_order", { ascending: true })
    .order("lunch_menu_item_id", { ascending: true });

  if (oErr) {
    logAdminApiDbError("GET lunch-menu event_day_lunch_menu_items", oErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }

  const { data: masters, error: mErr } = await supabase
    .from("lunch_menu_items")
    .select(
      "id, name, description, price_tax_included, is_active, sort_order, created_at"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (mErr) {
    logAdminApiDbError("GET lunch-menu lunch_menu_items", mErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }

  const { items: effectivePreview, dbError } =
    await fetchEffectiveLunchMenuItemsForEventDay(supabase, eventDayId);
  if (dbError) {
    logAdminApiDbError("GET lunch-menu fetchEffectiveLunchMenuItemsForEventDay", dbError);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }

  const customIds = (overrides ?? []).map(
    (r) => (r as { lunch_menu_item_id: string }).lunch_menu_item_id
  );

  return NextResponse.json({
    eventDayId,
    eventDate: (day as { event_date: string }).event_date,
    mode: customIds.length > 0 ? "custom" : "global",
    customMenuItemIds: customIds,
    masterItems: (masters ?? []) as MasterRow[],
    effectivePreview,
  });
}

type PutBody = {
  mode?: string;
  menu_item_ids?: unknown;
};

/** 管理者: 開催日の昼食をグローバル既定に戻す or この日専用に設定 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: eventDayId } = await context.params;
  if (!eventDayId || !UUID_RE.test(eventDayId)) {
    return NextResponse.json({ error: "開催日IDが不正です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = json as PutBody;
  const mode = typeof b.mode === "string" ? b.mode.trim() : "";

  const supabase = createServiceRoleClient();

  const { data: day, error: dErr } = await supabase
    .from("event_days")
    .select("id")
    .eq("id", eventDayId)
    .maybeSingle();

  if (dErr) {
    logAdminApiDbError("PUT lunch-menu event_days", dErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (!day) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  if (mode === "global") {
    const { error: delErr } = await supabase
      .from("event_day_lunch_menu_items")
      .delete()
      .eq("event_day_id", eventDayId);

    if (delErr) {
      logAdminApiDbError("PUT lunch-menu global delete overrides", delErr);
      return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
    }

    const { count, error: cErr } = await countGloballyActiveLunchMenus(supabase);
    if (cErr) {
      logAdminApiDbError("PUT lunch-menu countGloballyActiveLunchMenus", cErr);
      return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
    }
    if (count < 1) {
      return NextResponse.json(
        {
          error:
            "グローバル昼食に有効なメニューが1件もありません。先に /admin/lunch-menu で有効メニューを1件以上用意してください。",
          code: MIN_ACTIVE_LUNCH_MENUS,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, mode: "global" });
  }

  if (mode !== "custom") {
    return NextResponse.json(
      { error: "mode は global または custom を指定してください" },
      { status: 422 }
    );
  }

  if (!Array.isArray(b.menu_item_ids) || b.menu_item_ids.length === 0) {
    return NextResponse.json(
      { error: "custom のときは menu_item_ids に1件以上のUUIDを指定してください" },
      { status: 422 }
    );
  }

  const rawIds = b.menu_item_ids.map((x) => String(x).trim()).filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of rawIds) {
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: `メニューIDが不正です: ${id}` },
        { status: 422 }
      );
    }
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  if (unique.length === 0) {
    return NextResponse.json(
      { error: "menu_item_ids に有効なUUIDが必要です" },
      { status: 422 }
    );
  }

  const { data: menus, error: mErr } = await supabase
    .from("lunch_menu_items")
    .select("id, is_active")
    .in("id", unique);

  if (mErr) {
    logAdminApiDbError("PUT lunch-menu lunch_menu_items by ids", mErr);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }

  const found = new Map((menus ?? []).map((r) => [(r as { id: string }).id, r]));
  for (const id of unique) {
    const row = found.get(id) as { is_active: boolean } | undefined;
    if (!row) {
      return NextResponse.json(
        { error: `存在しないメニューIDが含まれています: ${id}` },
        { status: 422 }
      );
    }
    if (!row.is_active) {
      return NextResponse.json(
        {
          error:
            "非公開のメニューは開催日専用セットに含められません。先にグローバルで公開にしてください。",
          code: CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
        },
        { status: 422 }
      );
    }
  }

  const { error: delErr } = await supabase
    .from("event_day_lunch_menu_items")
    .delete()
    .eq("event_day_id", eventDayId);

  if (delErr) {
    logAdminApiDbError("PUT lunch-menu custom delete overrides", delErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  const inserts = unique.map((lunch_menu_item_id, sort_order) => ({
    event_day_id: eventDayId,
    lunch_menu_item_id,
    sort_order,
  }));

  const { error: insErr } = await supabase
    .from("event_day_lunch_menu_items")
    .insert(inserts);

  if (insErr) {
    logAdminApiDbError("PUT lunch-menu insert event_day_lunch_menu_items", insErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  const { items: effectivePreview, dbError } =
    await fetchEffectiveLunchMenuItemsForEventDay(supabase, eventDayId);
  if (dbError) {
    logAdminApiDbError("PUT lunch-menu fetchEffectiveLunchMenuItemsForEventDay", dbError);
    return NextResponse.json({ error: ADMIN_API_READ_ERROR_JA }, { status: 500 });
  }
  if (effectivePreview.length === 0) {
    return NextResponse.json(
      {
        error:
          "保存後の有効メニューが0件になりました。メニューの公開状態を確認してください。",
        code: CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, mode: "custom", effectivePreview });
}
