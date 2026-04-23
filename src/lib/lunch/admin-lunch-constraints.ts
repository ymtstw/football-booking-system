import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LunchMenuOption } from "./admin-lunch-constraints-shared";

export {
  CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
  MIN_ACTIVE_LUNCH_MENUS,
} from "./admin-lunch-constraints-shared";
export type { LunchMenuOption };

type Row = {
  id: string;
  name: string;
  is_active: boolean;
};

async function loadAllMenuRows(supabase: SupabaseClient): Promise<{
  rows: Row[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .select("id, name, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: (data ?? []) as Row[], error: null };
}

/** グローバルで is_active な昼食が何件あるか */
export async function countGloballyActiveLunchMenus(
  supabase: SupabaseClient
): Promise<{ count: number; error: string | null }> {
  const { rows, error } = await loadAllMenuRows(supabase);
  if (error) return { count: 0, error };
  return { count: rows.filter((r) => r.is_active).length, error: null };
}

/**
 * victim を非公開／削除したあと、グローバルで有効な昼食が何件残るかをシミュレート。
 * coActivate を指定すると、そのIDを先に有効化した前提。
 */
export function simulateGlobalActiveCount(
  rows: Row[],
  victimId: string,
  mode: "deactivate" | "delete",
  coActivateMenuItemId: string | null
): number {
  const co = coActivateMenuItemId?.trim() || null;
  let list = rows.map((r) => ({ ...r }));
  if (co) {
    list = list.map((r) => (r.id === co ? { ...r, is_active: true } : r));
  }
  if (mode === "deactivate") {
    list = list.map((r) =>
      r.id === victimId ? { ...r, is_active: false } : r
    );
  } else {
    list = list.filter((r) => r.id !== victimId);
  }
  return list.filter((r) => r.is_active).length;
}

/**
 * 開催日専用セットが「有効メニュー1件以上」を失わないか（victim をオフ／削除する前）。
 * 削除時は CASCADE で junction からも消える前提で、その日の残り候補を数える。
 */
export async function assertCustomDayMenusStayValid(
  supabase: SupabaseClient,
  victimMenuId: string,
  mode: "deactivate" | "delete",
  coActivateMenuItemId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: links, error } = await supabase
    .from("event_day_lunch_menu_items")
    .select("event_day_id, lunch_menu_item_id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!links?.length) {
    return { ok: true };
  }

  const { rows: allMenus, error: mErr } = await loadAllMenuRows(supabase);
  if (mErr) {
    return { ok: false, message: mErr };
  }

  const co = coActivateMenuItemId?.trim() || null;
  const simulated = allMenus
    .map((r) => {
      let is_active = r.is_active;
      if (co && r.id === co) is_active = true;
      if (mode === "deactivate" && r.id === victimMenuId) is_active = false;
      return { id: r.id, is_active };
    })
    .filter((r) => mode !== "delete" || r.id !== victimMenuId);

  const activeMap = new Map(simulated.map((r) => [r.id, r.is_active]));

  const byDay = new Map<string, string[]>();
  for (const raw of links) {
    const row = raw as { event_day_id: string; lunch_menu_item_id: string };
    const arr = byDay.get(row.event_day_id) ?? [];
    arr.push(row.lunch_menu_item_id);
    byDay.set(row.event_day_id, arr);
  }

  for (const [, mids] of byDay) {
    const unique = [...new Set(mids)];
    const afterMids =
      mode === "delete"
        ? unique.filter((id) => id !== victimMenuId)
        : unique;

    if (afterMids.length === 0) {
      continue;
    }

    const activeCount = afterMids.filter((id) => activeMap.get(id) === true).length;
    if (activeCount === 0) {
      return {
        ok: false,
        message:
          "この操作を行うと、開催日専用の昼食セットで有効なメニューが0件になります。該当開催日の昼食設定を変更するか、別のメニューを有効にしてください。",
      };
    }
  }

  return { ok: true };
}

export function menuOptionsExcluding(
  rows: Row[],
  excludeId: string
): LunchMenuOption[] {
  return rows
    .filter((r) => r.id !== excludeId)
    .map((r) => ({ id: r.id, name: r.name, is_active: r.is_active }));
}

export async function loadLunchMenuRowsForAdmin(
  supabase: SupabaseClient
): Promise<{ rows: Row[]; error: string | null }> {
  return loadAllMenuRows(supabase);
}
