import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  name: string;
  description: string | null;
  price_tax_included: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** 管理者: 昼食メニュー更新 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID が不正です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = json as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("name" in b) {
    if (typeof b.name !== "string") {
      return NextResponse.json({ error: "name は文字列です" }, { status: 422 });
    }
    const name = b.name.trim();
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: "メニュー名は 1〜120 文字で指定してください" },
        { status: 422 }
      );
    }
    patch.name = name;
  }

  if ("description" in b) {
    if (b.description !== null && typeof b.description !== "string") {
      return NextResponse.json(
        { error: "description は文字列または null です" },
        { status: 422 }
      );
    }
    const d =
      b.description === null
        ? null
        : (b.description as string).trim() || null;
    if (d != null && d.length > 2000) {
      return NextResponse.json(
        { error: "説明は 2000 文字以内です" },
        { status: 422 }
      );
    }
    patch.description = d;
  }

  if ("price_tax_included" in b) {
    const price =
      typeof b.price_tax_included === "number" &&
      Number.isFinite(b.price_tax_included)
        ? Math.round(b.price_tax_included as number)
        : NaN;
    if (!Number.isInteger(price) || price < 1) {
      return NextResponse.json(
        { error: "税込価格は 1 円以上の整数で指定してください" },
        { status: 422 }
      );
    }
    patch.price_tax_included = price;
  }

  if ("is_active" in b) {
    if (typeof b.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active は boolean です" },
        { status: 422 }
      );
    }
    patch.is_active = b.is_active;
  }

  if ("sort_order" in b) {
    const so =
      typeof b.sort_order === "number" && Number.isFinite(b.sort_order)
        ? Math.round(b.sort_order as number)
        : NaN;
    if (!Number.isInteger(so)) {
      return NextResponse.json(
        { error: "sort_order は整数で指定してください" },
        { status: 422 }
      );
    }
    patch.sort_order = so;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 422 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .update(patch)
    .eq("id", id)
    .select(
      "id, name, description, price_tax_included, is_active, sort_order, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "メニューが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ item: data as Row });
}

/** 管理者: 昼食メニュー削除（既存予約の menu_item_id は SET NULL） */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID が不正です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("lunch_menu_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
