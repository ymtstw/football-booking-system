"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import type { LunchMenuItemPublic } from "@/lib/lunch/types";

type MasterRow = {
  id: string;
  name: string;
  description: string | null;
  price_tax_included: number;
  is_active: boolean;
  sort_order: number;
};

type LoadJson = {
  mode?: string;
  customMenuItemIds?: string[];
  masterItems?: MasterRow[];
  effectivePreview?: LunchMenuItemPublic[];
  eventDate?: string;
  error?: string;
};

/** 開催日ごとの昼食（グローバル既定 or この日だけの組み合わせ） */
export function EventDayLunchMenuClient({ eventDayId }: { eventDayId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [mode, setMode] = useState<"global" | "custom">("global");
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [masterItems, setMasterItems] = useState<MasterRow[]>([]);
  const [effectivePreview, setEffectivePreview] = useState<LunchMenuItemPublic[]>([]);

  const selectableMasters = useMemo(
    () => masterItems.filter((m) => m.is_active),
    [masterItems]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/event-days/${encodeURIComponent(eventDayId)}/lunch-menu`
      );
      const j = (await res.json().catch(() => ({}))) as LoadJson;
      if (!res.ok) {
        setError(j.error ?? "読み込みに失敗しました");
        return;
      }
      setEventDate(typeof j.eventDate === "string" ? j.eventDate : "");
      setMode(j.mode === "custom" ? "custom" : "global");
      setCustomIds(Array.isArray(j.customMenuItemIds) ? j.customMenuItemIds : []);
      setMasterItems(Array.isArray(j.masterItems) ? j.masterItems : []);
      setEffectivePreview(
        Array.isArray(j.effectivePreview) ? j.effectivePreview : []
      );
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventDayId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleCustomId(id: string) {
    setCustomIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function selectGlobalMode() {
    setMode("global");
  }

  function selectCustomMode() {
    setMode("custom");
    setCustomIds((prev) => {
      if (prev.length > 0) return prev;
      const defaults = selectableMasters.map((m) => m.id);
      return defaults;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (mode === "global") {
        const res = await fetch(
          `/api/admin/event-days/${encodeURIComponent(eventDayId)}/lunch-menu`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "global" }),
          }
        );
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(j.error ?? "保存に失敗しました");
          return;
        }
        await load();
        return;
      }

      if (customIds.length === 0) {
        setError("この日専用では、有効なメニューを1件以上選んでください。");
        return;
      }

      const res = await fetch(
        `/api/admin/event-days/${encodeURIComponent(eventDayId)}/lunch-menu`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "custom", menu_item_ids: customIds }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "保存に失敗しました");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-zinc-600">
        開催日 <span className="font-semibold text-zinc-900">{eventDate}</span>
        。通常は
        <span className="font-medium text-zinc-800">既定（グローバル）</span>
        の昼食（
        <a
          href="/admin/lunch-menu"
          className="font-medium text-sky-800 underline decoration-sky-600/40 underline-offset-2"
        >
          昼食マスタ
        </a>
        で公開しているメニュー）が予約画面に出ます。必要な日だけ
        <span className="font-medium text-zinc-800">この日専用</span>
        に差し替えられます。
      </p>

      <fieldset className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="text-sm font-semibold text-zinc-900">適用モード</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="lunch-mode"
            checked={mode === "global"}
            onChange={selectGlobalMode}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-zinc-800">既定メニューを使う</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              ＝グローバルと同じ。マスタで「公開中」の昼食がそのままこの開催日の予約に出ます。
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="lunch-mode"
            checked={mode === "custom"}
            onChange={selectCustomMode}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-zinc-800">
              この日だけ専用メニューを使う
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              下の一覧から、この開催日に出すメニューだけに絞ります。マスタで非公開の品目は選べません。
            </span>
          </span>
        </label>
      </fieldset>

      {mode === "custom" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
          <p className="text-sm font-medium text-zinc-900">この日に出すメニュー（1件以上）</p>
          {selectableMasters.length === 0 ? (
            <p className="mt-2 text-sm text-amber-900">
              グローバルに有効なメニューがありません。先に昼食マスタで公開メニューを用意してください。
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectableMasters.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={customIds.includes(m.id)}
                      onChange={() => toggleCustomId(m.id)}
                    />
                    <span className="font-medium text-zinc-800">{m.name}</span>
                    <span className="tabular-nums text-zinc-600">
                      {formatTaxIncludedYen(m.price_tax_included)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-4">
        <p className="text-sm font-medium text-emerald-950">保存後の予約画面プレビュー</p>
        {effectivePreview.length === 0 ? (
          <p className="mt-2 text-sm text-amber-900">
            有効メニューが0件です。グローバルまたはこの日の設定を見直してください。
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc text-sm text-emerald-950">
            {effectivePreview.map((m) => (
              <li key={m.id}>
                {m.name}{" "}
                <span className="tabular-nums text-emerald-900/90">
                  {formatTaxIncludedYen(m.priceTaxIncluded)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <InlineSpinner variant="onDark" /> : null}
          保存
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}
