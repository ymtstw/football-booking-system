import { NextResponse } from "next/server";

import { fetchEffectiveLunchMenuItemsForEventDay } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_READ_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 公開 GET: 予約可能な昼食メニュー（税込）。
 * `eventDayId` 省略時はグローバル有効メニュー。指定時はその開催日の有効セット（専用があればサブセット）。
 */
export async function GET(request: Request) {
  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const eventDayIdRaw = searchParams.get("eventDayId");

  if (eventDayIdRaw != null && eventDayIdRaw.trim() !== "") {
    const eventDayId = eventDayIdRaw.trim();
    if (!UUID_RE.test(eventDayId)) {
      return NextResponse.json({ error: "eventDayId が不正です" }, { status: 400 });
    }

    const { data: day, error: dErr } = await supabase
      .from("event_days")
      .select("id")
      .eq("id", eventDayId)
      .maybeSingle();

    if (dErr) {
      logPublicReserveApiSupabaseError("GET /api/lunch-menu event_days", dErr);
      return NextResponse.json(
        { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: dErr.code },
        { status: 500 }
      );
    }
    if (!day) {
      return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
    }

    const { items, dbError } = await fetchEffectiveLunchMenuItemsForEventDay(
      supabase,
      eventDayId
    );
    if (dbError) {
      logPublicReserveApiSupabaseError("GET /api/lunch-menu effective menus", {
        message: dbError,
        code: "db_error",
      });
      return NextResponse.json(
        { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: "db_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items, eventDayId });
  }

  const { data, error } = await supabase
    .from("lunch_menu_items")
    .select("id, name, description, price_tax_included, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logPublicReserveApiSupabaseError("GET /api/lunch-menu lunch_menu_items", error);
    return NextResponse.json(
      { error: PUBLIC_RESERVE_API_READ_ERROR_JA, code: error.code },
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
