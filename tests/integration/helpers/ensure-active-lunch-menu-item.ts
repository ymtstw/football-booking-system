import { getIntegrationSupabase } from "./service-role-client";

/**
 * 結合テスト DB に active な lunch_menu_items が無いときに 1 件だけ投入する。
 * （ローカル db reset でシードがある場合は insert しない）
 *
 * @returns `insertedId` … この呼び出しで新規投入した行の id（不要なら後始末で delete）
 */
export async function ensureAtLeastOneActiveLunchMenuItem(): Promise<{
  insertedId: string | null;
}> {
  const supa = getIntegrationSupabase();
  const { count, error } = await supa
    .from("lunch_menu_items")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  if ((count ?? 0) >= 1) {
    return { insertedId: null };
  }

  const { data, error: insErr } = await supa
    .from("lunch_menu_items")
    .insert({
      name: "結合テスト用昼食（ensure 自動投入）",
      description: null,
      price_tax_included: 600,
      is_active: true,
      sort_order: -98,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return { insertedId: data.id as string };
}
