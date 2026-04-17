"use client";

import { useCallback, useEffect, useState } from "react";

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

export function LunchMenuAdminClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const price = Math.round(Number(fd.get("price") ?? NaN));
    const sort_order = Math.round(Number(fd.get("sort_order") ?? 0));
    setError(null);
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
  }

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/lunch-menu-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    if (!res.ok) {
      setError(j.error ?? "更新に失敗しました");
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "このメニューを削除しますか？（過去予約の明細はスナップショットのまま残ります）"
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/lunch-menu-items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    if (!res.ok) {
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

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">メニュー追加</h2>
        <form className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2" onSubmit={(e) => void handleCreate(e)}>
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
            <span className="text-zinc-600">税込価格（円・整数）</span>
            <input
              name="price"
              type="number"
              required
              min={1}
              step={1}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">並び順</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              step={1}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              追加
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">メニュー一覧・変更</h2>
        <p className="mt-1 text-xs text-zinc-500">
          表示 OFF にしたメニューは新規予約では選べません。既存予約の金額・名称は変わりません。
        </p>
        <div className="mt-4 space-y-6">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3 sm:p-4"
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
                  <span className="text-zinc-600">税込（円）</span>
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
                <label className="block text-sm">
                  <span className="text-zinc-600">並び順</span>
                  <input
                    name="sort_order"
                    type="number"
                    step={1}
                    defaultValue={it.sort_order}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
                  <button
                    type="submit"
                    disabled={busyId === it.id}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    変更を保存
                  </button>
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => void patchRow(it.id, { is_active: !it.is_active })}
                    className="text-sm text-sky-700 underline underline-offset-2 hover:text-sky-900 disabled:opacity-50"
                  >
                    表示: {it.is_active ? "ON" : "OFF"}（切替）
                  </button>
                  <button
                    type="button"
                    className="text-sm text-red-700 underline underline-offset-2 disabled:opacity-50"
                    disabled={busyId === it.id}
                    onClick={() => void handleDelete(it.id)}
                  >
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
