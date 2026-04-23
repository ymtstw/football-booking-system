import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LunchMenuItemPublic } from "./types";

async function loadGlobalActiveLunchMenus(
  supabase: SupabaseClient
): Promise<{ items: LunchMenuItemPublic[]; dbError: string | null }> {
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .select("id, name, description, price_tax_included, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { items: [], dbError: error.message };
  }
  return { items: mapToPublic(data ?? []), dbError: null };
}

function mapToPublic(rows: Array<Record<string, unknown>>): LunchMenuItemPublic[] {
  return rows.map((row) => {
    const r = row as {
      id: string;
      name: string;
      description: string | null;
      price_tax_included: number;
      sort_order: number;
    };
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      priceTaxIncluded: Number(r.price_tax_included),
      sortOrder: Number(r.sort_order),
    };
  });
}

/**
 * 開催日に紐づく「予約で選べる昼食」の一覧。
 * event_day_lunch_menu_items が 0 件のときはグローバル有効メニュー、1件以上のときはそのサブセット（有効のみ）。
 */
export async function fetchEffectiveLunchMenuItemsForEventDay(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<{ items: LunchMenuItemPublic[]; dbError: string | null }> {
  const { data: overrides, error: ovErr } = await supabase
    .from("event_day_lunch_menu_items")
    .select("lunch_menu_item_id, sort_order")
    .eq("event_day_id", eventDayId)
    .order("sort_order", { ascending: true })
    .order("lunch_menu_item_id", { ascending: true });

  if (ovErr) {
    // マイグレーション未適用の PostgREST（PGRST205）では専用行なしと同等に扱いグローバルのみ返す
    if (ovErr.code === "PGRST205") {
      return loadGlobalActiveLunchMenus(supabase);
    }
    return { items: [], dbError: ovErr.message };
  }

  if (!overrides?.length) {
    return loadGlobalActiveLunchMenus(supabase);
  }

  const ids = overrides.map(
    (o) => (o as { lunch_menu_item_id: string }).lunch_menu_item_id
  );
  const orderIndex = new Map(ids.map((id, i) => [id, i]));

  const { data: menus, error: mErr } = await supabase
    .from("lunch_menu_items")
    .select("id, name, description, price_tax_included, sort_order")
    .in("id", ids)
    .eq("is_active", true);

  if (mErr) {
    return { items: [], dbError: mErr.message };
  }

  const rows = [...(menus ?? [])] as Array<Record<string, unknown>>;
  rows.sort((a, b) => {
    const ia = orderIndex.get((a as { id: string }).id) ?? 999;
    const ib = orderIndex.get((b as { id: string }).id) ?? 999;
    return ia - ib;
  });

  return { items: mapToPublic(rows), dbError: null };
}

/**
 * 予約受付開始（`status` を `open` にする）直前のゲート。
 * 専用行が0件ならグローバル有効、1件以上ならそのサブセットのうち有効のみ——いずれも
 * `fetchEffectiveLunchMenuItemsForEventDay` と同じ集合で、1件も無ければ公開不可。
 */
export async function assertEventDayAcceptsBookableLunchMenus(
  supabase: SupabaseClient,
  eventDayId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { items, dbError } = await fetchEffectiveLunchMenuItemsForEventDay(
    supabase,
    eventDayId
  );
  if (dbError) {
    return { ok: false, message: dbError };
  }
  if (items.length === 0) {
    return {
      ok: false,
      message:
        "予約受付を開始できません。選べる昼食が0件です。昼食マスタでグローバル有効を1件以上にするか、この開催日の専用セットで有効が1件以上になるよう設定してください。",
    };
  }
  return { ok: true };
}
