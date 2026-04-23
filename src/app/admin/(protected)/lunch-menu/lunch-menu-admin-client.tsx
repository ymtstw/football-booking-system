"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  MIN_ACTIVE_LUNCH_MENUS,
  type LunchMenuOption,
} from "@/lib/lunch/admin-lunch-constraints-shared";

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

/** 予約画面のメニュー並び＝数字が小さいほど上（同値は登録が早い順） */
const SORT_HINT =
  "数字が小さいほど、予約フォームのメニュー一覧の上に表示されます。同じ数字のときは、先に登録したメニューが上になります。";

function SortOrderHint({ id }: { id?: string }) {
  return (
    <p
      id={id}
      className="mt-1.5 text-xs leading-relaxed text-zinc-500"
    >
      {SORT_HINT}
    </p>
  );
}

/** 新規予約で選べるかどうか（即時反映・保存ボタン不要） */
function ReservationVisibilityToggle({
  isActive,
  disabled,
  onChoose,
}: {
  isActive: boolean;
  disabled: boolean;
  onChoose: (next: boolean) => void | Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-zinc-800">新規予約での公開</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isActive
              ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/80"
              : "bg-red-100 text-red-900 ring-1 ring-red-300/80"
          }`}
        >
          {isActive ? "公開中" : "非公開中"}
        </span>
      </div>
      <div
        className={`inline-flex rounded-xl border p-1 shadow-inner ${
          isActive
            ? "border-emerald-200/90 bg-emerald-50/50"
            : "border-red-200/90 bg-red-50/40"
        }`}
        role="group"
        aria-label="新規予約でこのメニューを選べるか"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!isActive) void onChoose(true);
          }}
          className={`min-h-10 min-w-30 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/30 hover:bg-emerald-700"
              : "text-zinc-600 hover:bg-emerald-100/60 hover:text-emerald-900"
          }`}
        >
          公開する
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (isActive) void onChoose(false);
          }}
          className={`min-h-10 min-w-30 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            !isActive
              ? "bg-red-600 text-white shadow-sm ring-1 ring-red-700/30 hover:bg-red-700"
              : "text-zinc-600 hover:bg-red-100/70 hover:text-red-900"
          }`}
        >
          非公開にする
        </button>
      </div>
      <p className="max-w-lg text-xs leading-relaxed text-zinc-500">
        「非公開」にすると、これからの新規予約では選べなくなります。すでに予約に記録されているメニュー名・金額は変わりません。
      </p>
    </div>
  );
}

export function LunchMenuAdminClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** 有効メニュー1件制約: 別メニューを同時に公開してから非公開／削除する */
  const [minActiveModal, setMinActiveModal] = useState<null | {
    kind: "deactivate" | "delete";
    targetId: string;
    options: LunchMenuOption[];
  }>(null);
  const [selectedCoId, setSelectedCoId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/lunch-menu-items");
      const j = (await res.json().catch(() => ({}))) as {
        items?: Row[];
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? "読み込みに失敗しました");
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setError("読み込みに失敗しました");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 一覧が空なら 0、それ以外は既存の最大 sort_order の次の整数（0 から連番で足す想定） */
  const nextSortOrderForNew = useMemo(() => {
    if (items.length === 0) return 0;
    const max = Math.max(...items.map((i) => i.sort_order));
    return Number.isFinite(max) ? max + 1 : 0;
  }, [items]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const price = Math.round(Number(fd.get("price") ?? NaN));
    const sort_order = Math.round(Number(fd.get("sort_order") ?? 0));
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/lunch-menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          price_tax_included: price,
          is_active: true,
          sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "追加に失敗しました");
        return;
      }
      form.reset();
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/lunch-menu-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      menuOptions?: LunchMenuOption[];
    };
    setBusyId(null);
    if (!res.ok) {
      if (
        res.status === 422 &&
        j.code === MIN_ACTIVE_LUNCH_MENUS &&
        patch.is_active === false
      ) {
        if (Array.isArray(j.menuOptions) && j.menuOptions.length > 0) {
          const firstInactive = j.menuOptions.find((o) => !o.is_active);
          setSelectedCoId(firstInactive?.id ?? j.menuOptions[0]?.id ?? "");
          setMinActiveModal({ kind: "deactivate", targetId: id, options: j.menuOptions });
          return;
        }
      }
      setError(j.error ?? "更新に失敗しました");
      return;
    }
    await load();
  }

  async function requestVisibilityChange(id: string, next: boolean) {
    if (next) {
      await patchRow(id, { is_active: true });
      return;
    }
    await patchRow(id, { is_active: false });
  }

  async function confirmMinActiveModal() {
    if (!minActiveModal || !selectedCoId) return;
    const { kind, targetId } = minActiveModal;
    setMinActiveModal(null);
    setError(null);
    if (kind === "deactivate") {
      setBusyId(targetId);
      const res = await fetch(
        `/api/admin/lunch-menu-items/${encodeURIComponent(targetId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_active: false,
            co_activate_menu_item_id: selectedCoId,
          }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setBusyId(null);
      if (!res.ok) {
        setError(j.error ?? "更新に失敗しました");
        return;
      }
      await load();
      return;
    }

    setBusyId(targetId);
    const res = await fetch(
      `/api/admin/lunch-menu-items/${encodeURIComponent(targetId)}?promote_active_first=${encodeURIComponent(selectedCoId)}`,
      { method: "DELETE" }
    );
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    if (!res.ok) {
      setError(j.error ?? "削除に失敗しました");
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "このメニューを削除しますか？\n\n" +
          "・すでに予約に記録されたメニュー名・金額は消えません。\n" +
          "・これからの新規予約では、このメニューは選べなくなります。"
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/lunch-menu-items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      menuOptions?: LunchMenuOption[];
    };
    setBusyId(null);
    if (!res.ok) {
      if (
        res.status === 422 &&
        j.code === MIN_ACTIVE_LUNCH_MENUS &&
        Array.isArray(j.menuOptions) &&
        j.menuOptions.length > 0
      ) {
        const firstInactive = j.menuOptions.find((o) => !o.is_active);
        setSelectedCoId(firstInactive?.id ?? j.menuOptions[0]?.id ?? "");
        setMinActiveModal({ kind: "delete", targetId: id, options: j.menuOptions });
        return;
      }
      setError(j.error ?? "削除に失敗しました");
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {minActiveModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="min-active-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40"
            aria-label="閉じる"
            onClick={() => setMinActiveModal(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h2 id="min-active-title" className="text-sm font-semibold text-zinc-900">
              {minActiveModal.kind === "delete"
                ? "削除の前に、公開を続けるメニューを選んでください"
                : "非公開の前に、公開を続けるメニューを選んでください"}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              有効な昼食は常に1件以上必要です。下で別メニューを選び、確定すると
              {minActiveModal.kind === "delete"
                ? "そのメニューを公開したうえで削除します。"
                : "そのメニューを公開したうえで、対象を非公開にします。"}
            </p>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded border border-zinc-100 p-2">
              {minActiveModal.options.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50"
                >
                  <input
                    type="radio"
                    name="co-activate-lunch"
                    checked={selectedCoId === o.id}
                    onChange={() => setSelectedCoId(o.id)}
                  />
                  <span className="font-medium text-zinc-800">{o.name}</span>
                  <span
                    className={`text-xs ${o.is_active ? "text-emerald-700" : "text-zinc-500"}`}
                  >
                    {o.is_active ? "公開中" : "非公開"}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                onClick={() => setMinActiveModal(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={!selectedCoId || busyId !== null}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                onClick={() => void confirmMinActiveModal()}
              >
                確定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">メニュー追加</h2>
        <p className="mt-1 text-xs text-zinc-500">
          追加したメニューは「公開する」状態で登録されます（下の一覧からいつでも非公開にできます）。
          表示順は、いまある番号の<strong className="font-medium text-zinc-600">次の数字</strong>
          が自動入力されます（メニューがまだ無いときは 0 から）。
        </p>
        <form
          className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2"
          onSubmit={(e) => void handleCreate(e)}
        >
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-600">メニュー名</span>
            <input
              name="name"
              required
              maxLength={120}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-600">説明（任意）</span>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">税込価格（円）</span>
            <input
              name="price"
              type="number"
              required
              min={1}
              step={1}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="block text-sm sm:col-span-1">
            <label htmlFor="create-sort-order" className="text-zinc-600">
              予約画面での表示順（番号）
            </label>
            <input
              id="create-sort-order"
              key={`create-sort-${nextSortOrderForNew}-${items.length}`}
              name="sort_order"
              type="number"
              defaultValue={nextSortOrderForNew}
              step={1}
              min={0}
              aria-describedby="create-sort-hint"
              className="mt-1 w-full max-w-48 rounded border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
            <SortOrderHint id="create-sort-hint" />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating || busyId !== null}
              aria-busy={creating || undefined}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? <InlineSpinner variant="onDark" /> : null}
              追加
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">メニュー一覧・変更</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          下の並びは<strong className="font-medium text-zinc-700">表示順</strong>
          の小さい順（同じなら登録が早い順）です。予約フォームでも同じ順で表示されます。
        </p>
        <div className="mt-4 space-y-6">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 sm:p-4"
            >
              <form
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const name = String(fd.get("name") ?? "").trim();
                  const description = String(fd.get("description") ?? "").trim();
                  const price = Math.round(Number(fd.get("price") ?? NaN));
                  const sort_order = Math.round(Number(fd.get("sort_order") ?? NaN));
                  if (!name) return;
                  if (!Number.isInteger(price) || price < 1) return;
                  if (!Number.isInteger(sort_order)) return;
                  void patchRow(it.id, {
                    name,
                    description: description || null,
                    price_tax_included: price,
                    sort_order,
                  });
                }}
              >
                <label className="block text-sm sm:col-span-2">
                  <span className="text-zinc-600">メニュー名</span>
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={it.name}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-zinc-600">説明</span>
                  <textarea
                    name="description"
                    rows={2}
                    maxLength={2000}
                    defaultValue={it.description ?? ""}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-600">税込価格（円）</span>
                  <input
                    name="price"
                    type="number"
                    required
                    min={1}
                    step={1}
                    defaultValue={it.price_tax_included}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="block text-sm">
                  <label
                    htmlFor={`sort-order-${it.id}`}
                    className="text-zinc-600"
                  >
                    予約画面での表示順（番号）
                  </label>
                  <input
                    id={`sort-order-${it.id}`}
                    name="sort_order"
                    type="number"
                    step={1}
                    defaultValue={it.sort_order}
                    aria-describedby={`sort-hint-${it.id}`}
                    className="mt-1 w-full max-w-48 rounded border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums"
                  />
                  <SortOrderHint id={`sort-hint-${it.id}`} />
                </div>

                <div className="border-t border-zinc-200 pt-4 sm:col-span-2 lg:col-span-4">
                  <ReservationVisibilityToggle
                    isActive={it.is_active}
                    disabled={busyId === it.id || creating}
                    onChoose={(next) => void requestVisibilityChange(it.id, next)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
                  <button
                    type="submit"
                    disabled={busyId === it.id || creating}
                    aria-busy={busyId === it.id || undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === it.id ? <InlineSpinner variant="onDark" /> : null}
                    名前・価格・表示順を保存
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-red-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busyId === it.id || creating}
                    aria-busy={busyId === it.id || undefined}
                    onClick={() => void handleDelete(it.id)}
                  >
                    {busyId === it.id ? <InlineSpinner variant="onLight" /> : null}
                    削除
                  </button>
                </div>
              </form>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">メニューがありません。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
