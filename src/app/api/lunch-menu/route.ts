import { NextResponse } from "next/server";

import type { LunchMenuItemPublic } from "@/lib/lunch/types";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** 公開 GET: 予約可能な昼食メニュー（表示 ON のみ・税込） */
export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .select("id, name, description, price_tax_included, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  const items: LunchMenuItemPublic[] = (data ?? []).map((r) => {
    const row = r as {
      id: string;
      name: string;
      description: string | null;
      price_tax_included: number;
      sort_order: number;
    };
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceTaxIncluded: Number(row.price_tax_included),
      sortOrder: Number(row.sort_order),
    };
  });

  return NextResponse.json({ items });
}
