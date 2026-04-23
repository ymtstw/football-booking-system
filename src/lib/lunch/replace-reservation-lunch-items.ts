import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchEffectiveLunchMenuItemsForEventDay } from "./effective-lunch-menu-for-event-day";
import type { ParsedLunchItem } from "./parse-lunch-items-body";

export type ReplaceLunchItemsResult =
  | { ok: true }
  | { ok: false; code: "lunch_menu_invalid" | "lunch_duplicate" | "db_error"; message: string };

/**
 * 予約の昼食明細を全差し替え（締切前 PATCH 用）。単価・名称はこの時点のメニューでスナップショット。
 */
export async function replaceReservationLunchItems(
  supabase: SupabaseClient,
  reservationId: string,
  eventDayId: string,
  items: ParsedLunchItem[]
): Promise<ReplaceLunchItemsResult> {
  const activeIds = new Set<string>();
  const byId = new Map<
    string,
    { name: string; price_tax_included: number }
  >();

  const seen = new Set<string>();
  for (const { menuItemId, quantity } of items) {
    if (quantity <= 0) continue;
    if (seen.has(menuItemId)) {
      return { ok: false, code: "lunch_duplicate", message: "メニューが重複しています" };
    }
    seen.add(menuItemId);
  }

  const { items: effectiveMenus, dbError: menuErr } =
    await fetchEffectiveLunchMenuItemsForEventDay(supabase, eventDayId);

  if (menuErr) {
    return {
      ok: false,
      code: "db_error",
      message: menuErr,
    };
  }

  for (const m of effectiveMenus) {
    activeIds.add(m.id);
    byId.set(m.id, {
      name: m.name,
      price_tax_included: m.priceTaxIncluded,
    });
  }

  const lines: Array<{
    reservation_id: string;
    menu_item_id: string;
    item_name_snapshot: string;
    unit_price_snapshot_tax_included: number;
    quantity: number;
    line_total: number;
  }> = [];

  for (const { menuItemId, quantity } of items) {
    if (quantity <= 0) continue;
    const menu = byId.get(menuItemId);
    if (!menu || !activeIds.has(menuItemId)) {
      return {
        ok: false,
        code: "lunch_menu_invalid",
        message: "選択できない昼食メニューが含まれています",
      };
    }
    const unit = menu.price_tax_included;
    if (!Number.isFinite(unit) || unit <= 0) {
      return {
        ok: false,
        code: "lunch_menu_invalid",
        message: "メニュー価格が不正です",
      };
    }
    lines.push({
      reservation_id: reservationId,
      menu_item_id: menuItemId,
      item_name_snapshot: menu.name,
      unit_price_snapshot_tax_included: unit,
      quantity,
      line_total: quantity * unit,
    });
  }

  const { error: delErr } = await supabase
    .from("reservation_lunch_items")
    .delete()
    .eq("reservation_id", reservationId);

  if (delErr) {
    return { ok: false, code: "db_error", message: delErr.message };
  }

  if (lines.length === 0) {
    return { ok: true };
  }

  const { error: insErr } = await supabase.from("reservation_lunch_items").insert(lines);

  if (insErr) {
    return { ok: false, code: "db_error", message: insErr.message };
  }

  return { ok: true };
}
