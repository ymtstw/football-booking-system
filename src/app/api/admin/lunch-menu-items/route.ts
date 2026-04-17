import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

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

/** 管理者: 昼食メニュー一覧 */
export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .select(
      "id, name, description, price_tax_included, is_active, sort_order, created_at, updated_at"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: (data ?? []) as Row[] });
}

type CreateBody = {
  name?: string;
  description?: string | null;
  price_tax_included?: number;
  is_active?: boolean;
  sort_order?: number;
};

/** 管理者: 昼食メニュー追加 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const b = json as CreateBody;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "メニュー名は 1〜120 文字で指定してください" },
      { status: 422 }
    );
  }

  const description =
    b.description === null || b.description === undefined
      ? null
      : typeof b.description === "string"
        ? b.description.trim() || null
        : null;
  if (description != null && description.length > 2000) {
    return NextResponse.json(
      { error: "説明は 2000 文字以内で指定してください" },
      { status: 422 }
    );
  }

  const price =
    typeof b.price_tax_included === "number" && Number.isFinite(b.price_tax_included)
      ? Math.round(b.price_tax_included)
      : NaN;
  if (!Number.isInteger(price) || price < 1) {
    return NextResponse.json(
      { error: "税込価格は 1 円以上の整数で指定してください" },
      { status: 422 }
    );
  }

  const isActive = b.is_active !== false;
  const sortOrder =
    typeof b.sort_order === "number" && Number.isFinite(b.sort_order)
      ? Math.round(b.sort_order)
      : 0;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("lunch_menu_items")
    .insert({
      name,
      description,
      price_tax_included: price,
      is_active: isActive,
      sort_order: sortOrder,
    })
    .select(
      "id, name, description, price_tax_included, is_active, sort_order, created_at, updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data as Row }, { status: 201 });
}
