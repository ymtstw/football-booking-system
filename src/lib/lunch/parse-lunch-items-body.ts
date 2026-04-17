const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ParsedLunchItem = { menuItemId: string; quantity: number };

/** POST /api/reservations / PATCH 用: [{ menuItemId, quantity }] を検証 */
export function parseLunchItemsInput(raw: unknown): ParsedLunchItem[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: ParsedLunchItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (row === null || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const menuItemId =
      typeof o.menuItemId === "string"
        ? o.menuItemId.trim()
        : typeof o.menu_item_id === "string"
          ? o.menu_item_id.trim()
          : "";
    if (!UUID_RE.test(menuItemId)) return null;
    if (seen.has(menuItemId)) return null;
    seen.add(menuItemId);
    const quantityRaw = o.quantity;
    const quantity =
      typeof quantityRaw === "number" && Number.isFinite(quantityRaw)
        ? quantityRaw
        : typeof quantityRaw === "string" && quantityRaw.trim() !== ""
          ? Number(quantityRaw.trim())
          : NaN;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 500) {
      return null;
    }
    out.push({ menuItemId, quantity });
  }
  return out;
}

/** RPC 用 JSON（キーは DB 側の期待に合わせる） */
export function lunchItemsToRpcJson(items: ParsedLunchItem[]): unknown {
  return items.map((i) => ({
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
  }));
}
