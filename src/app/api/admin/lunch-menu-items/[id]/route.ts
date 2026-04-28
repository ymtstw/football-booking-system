import { NextResponse } from "next/server";

import {
  ADMIN_API_DB_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import {
  assertCustomDayMenusStayValid,
  CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
  loadLunchMenuRowsForAdmin,
  menuOptionsExcluding,
  MIN_ACTIVE_LUNCH_MENUS,
  simulateGlobalActiveCount,
} from "@/lib/lunch/admin-lunch-constraints";
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
    if (so < 0) {
      return NextResponse.json(
        { error: "表示順は 0 以上の整数で指定してください" },
        { status: 422 }
      );
    }
    patch.sort_order = so;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  if (patch.is_active === false) {
    const coRaw = b.co_activate_menu_item_id;
    let coActivateId: string | null = null;
    if (coRaw !== undefined && coRaw !== null) {
      if (typeof coRaw !== "string" || !UUID_RE.test(coRaw)) {
        return NextResponse.json(
          { error: "co_activate_menu_item_id は UUID 文字列で指定してください" },
          { status: 422 }
        );
      }
      coActivateId = coRaw;
    }

    if (coActivateId === id) {
      return NextResponse.json(
        { error: "co_activate_menu_item_id は更新対象と別のメニューを指定してください" },
        { status: 422 }
      );
    }

    const { rows, error: rowErr } = await loadLunchMenuRowsForAdmin(supabase);
    if (rowErr) {
      logAdminApiDbError("PATCH /api/admin/lunch-menu-items/[id] loadLunchMenuRowsForAdmin", rowErr);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }
    if (coActivateId && !rows.some((r) => r.id === coActivateId)) {
      return NextResponse.json(
        { error: "co_activate_menu_item_id が見つかりません" },
        { status: 422 }
      );
    }

    const custom = await assertCustomDayMenusStayValid(
      supabase,
      id,
      "deactivate",
      coActivateId
    );
    if (!custom.ok) {
      return NextResponse.json(
        {
          error: custom.message,
          code: CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
        },
        { status: 422 }
      );
    }

    const activeAfter = simulateGlobalActiveCount(
      rows,
      id,
      "deactivate",
      coActivateId
    );
    if (activeAfter < 1) {
      return NextResponse.json(
        {
          error:
            "有効な昼食メニューは常に1件以上必要です。別のメニューを公開にするか、co_activate_menu_item_id で同時に公開するメニューを指定してください。",
          code: MIN_ACTIVE_LUNCH_MENUS,
          menuOptions: menuOptionsExcluding(rows, id),
        },
        { status: 422 }
      );
    }

    if (coActivateId) {
      const { error: coErr } = await supabase
        .from("lunch_menu_items")
        .update({ is_active: true })
        .eq("id", coActivateId);
      if (coErr) {
        logAdminApiDbError("PATCH /api/admin/lunch-menu-items/[id] coActivate", coErr);
        return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("lunch_menu_items")
    .update(patch)
    .eq("id", id)
    .select(
      "id, name, description, price_tax_included, is_active, sort_order, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    logAdminApiDbError("PATCH /api/admin/lunch-menu-items/[id] update", error);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "メニューが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ item: data as Row });
}

/**
 * 管理者: 昼食メニュー削除（既存予約の menu_item_id は SET NULL）。
 * 有効メニューが0件になる削除は拒否。`?promote_active_first=<uuid>` で先に別メニューを公開してから削除可。
 */
export async function DELETE(
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

  const url = new URL(request.url);
  const promoteRaw = url.searchParams.get("promote_active_first");
  const promoteId =
    promoteRaw && UUID_RE.test(promoteRaw) && promoteRaw !== id
      ? promoteRaw
      : null;

  const supabase = createServiceRoleClient();

  const { rows, error: rowErr } = await loadLunchMenuRowsForAdmin(supabase);
  if (rowErr) {
    logAdminApiDbError("DELETE /api/admin/lunch-menu-items/[id] loadLunchMenuRowsForAdmin", rowErr);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  if (!rows.some((r) => r.id === id)) {
    return NextResponse.json({ error: "メニューが見つかりません" }, { status: 404 });
  }

  if (rows.length <= 1) {
    return NextResponse.json(
      {
        error:
          "昼食メニューはマスタ上1件以上残す必要があります。削除の代わりに非公開にしてください。",
        code: MIN_ACTIVE_LUNCH_MENUS,
      },
      { status: 422 }
    );
  }

  if (promoteId && !rows.some((r) => r.id === promoteId)) {
    return NextResponse.json(
      { error: "promote_active_first が見つかりません" },
      { status: 422 }
    );
  }

  const custom = await assertCustomDayMenusStayValid(
    supabase,
    id,
    "delete",
    promoteId
  );
  if (!custom.ok) {
    return NextResponse.json(
      {
        error: custom.message,
        code: CUSTOM_DAY_LUNCH_NEEDS_ACTIVE,
      },
      { status: 422 }
    );
  }

  const activeAfter = simulateGlobalActiveCount(rows, id, "delete", promoteId);
  if (activeAfter < 1) {
    return NextResponse.json(
      {
        error:
          "有効な昼食メニューは常に1件以上必要です。別のメニューを公開にするか、co_activate_menu_item_id で同時に公開するメニューを指定してください。",
        code: MIN_ACTIVE_LUNCH_MENUS,
        menuOptions: menuOptionsExcluding(rows, id),
      },
      { status: 422 }
    );
  }

  if (promoteId) {
    const { error: prErr } = await supabase
      .from("lunch_menu_items")
      .update({ is_active: true })
      .eq("id", promoteId);
    if (prErr) {
      logAdminApiDbError("DELETE /api/admin/lunch-menu-items/[id] promote", prErr);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }
  }

  const { error } = await supabase.from("lunch_menu_items").delete().eq("id", id);

  if (error) {
    logAdminApiDbError("DELETE /api/admin/lunch-menu-items/[id] delete", error);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
