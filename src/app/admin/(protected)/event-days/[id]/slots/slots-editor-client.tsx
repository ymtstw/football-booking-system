"use client";

/** 枠の時刻の編集と「6枠運用／8枠運用」の切替（API 連携）。 */
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA,
  eventDaySlotPhaseCountsOk,
} from "@/lib/event-days/event-day-slot-count-policy";
import { eventSlotLabelJa, slotCodeOrderKey } from "@/lib/admin/operator-display";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type EventDaySlotEditorRow = {
  id: string;
  slot_code: string;
  phase: string;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
  is_time_changed: boolean;
  is_locked: boolean;
};

function timeInputValue(pg: string): string {
  const s = String(pg).trim().split(/[Zz+]/)[0]?.split(".")[0] ?? "";
  const m = s.match(/^(\d{2}:\d{2})/);
  return m ? m[1]! : "";
}

function phaseLabelJa(phase: string): string {
  return phase === "morning" ? "午前" : phase === "afternoon" ? "午後" : phase;
}

function sortSlotsByCode(rows: EventDaySlotEditorRow[]): EventDaySlotEditorRow[] {
  return [...rows].sort(
    (a, b) => slotCodeOrderKey(a.slot_code) - slotCodeOrderKey(b.slot_code)
  );
}

type OperationalSixEight = "six" | "eight" | "custom";

/** 午前・午後が各4枠のとき、6枠運用／8枠運用／それ以外 */
function deriveOperationalSixEight(
  morning: EventDaySlotEditorRow[],
  afternoon: EventDaySlotEditorRow[]
): OperationalSixEight | null {
  if (morning.length !== 4 || afternoon.length !== 4) return null;
  const ms = sortSlotsByCode(morning);
  const as = sortSlotsByCode(afternoon);
  const allOn = (r: EventDaySlotEditorRow[]) => r.every((x) => x.is_active);
  const sixPattern =
    ms[0]!.is_active &&
    ms[1]!.is_active &&
    ms[2]!.is_active &&
    !ms[3]!.is_active &&
    as[0]!.is_active &&
    as[1]!.is_active &&
    as[2]!.is_active &&
    !as[3]!.is_active;
  if (allOn(ms) && allOn(as)) return "eight";
  if (sixPattern) return "six";
  return "custom";
}

/** 4+4 のとき、午前・午後の「4枠目」以外は有効にし、6/8 に合わせて4枠目だけ切り替える */
function applyOperationalSixEight(
  prev: EventDaySlotEditorRow[],
  mode: "six" | "eight"
): EventDaySlotEditorRow[] {
  const fourthOn = mode === "eight";
  return prev.map((s) => {
    if (s.phase !== "morning" && s.phase !== "afternoon") return s;
    const phaseRows = sortSlotsByCode(
      prev.filter((x) => x.phase === s.phase)
    );
    if (phaseRows.length !== 4) return s;
    const rank = phaseRows.findIndex((x) => x.id === s.id);
    if (rank < 0) return s;
    if (rank < 3) return { ...s, is_active: true };
    return { ...s, is_active: fourthOn };
  });
}

export function SlotsEditorClient({
  eventDayId,
  initialSlots,
  editable,
  mutationMode = "normal",
}: {
  eventDayId: string;
  initialSlots: EventDaySlotEditorRow[];
  editable: boolean;
  /** `force` のときは `/slots/force` API と `acknowledgeReservationRisk` を使う */
  mutationMode?: "normal" | "force";
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<EventDaySlotEditorRow[]>(initialSlots);
  const [busy, setBusy] = useState<"idle" | "save">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const morning = useMemo(
    () => slots.filter((s) => s.phase === "morning"),
    [slots]
  );
  const afternoon = useMemo(
    () => slots.filter((s) => s.phase === "afternoon"),
    [slots]
  );

  const countsPolicyOk = useMemo(
    () => eventDaySlotPhaseCountsOk(morning.length, afternoon.length),
    [morning.length, afternoon.length]
  );

  const operationalSixEight = useMemo(
    () => deriveOperationalSixEight(morning, afternoon),
    [morning, afternoon]
  );

  /** 4+4 の新方針では行ごとの有効チェックは出さない。旧データ（3+3 等）の互換表示のみ出す。 */
  const showRowActiveCheckbox = morning.length !== 4 || afternoon.length !== 4;

  const slotsApiBase = `/api/admin/event-days/${eventDayId}/slots${
    mutationMode === "force" ? "/force" : ""
  }`;

  function updateSlot(
    id: string,
    patch: Partial<
      Pick<EventDaySlotEditorRow, "start_time" | "end_time" | "is_active">
    >
  ) {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  async function handleSave() {
    if (!editable) return;
    setError(null);
    setBusy("save");
    try {
      const res = await fetch(slotsApiBase, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mutationMode === "force"
            ? { acknowledgeReservationRisk: true as const }
            : {}),
          slots: slots.map((s) => ({
            id: s.id,
            startTime: timeInputValue(s.start_time) + ":00",
            endTime: timeInputValue(s.end_time) + ":00",
            isActive: s.is_active,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        slots?: EventDaySlotEditorRow[];
      };
      if (!res.ok) {
        setError(json.error ?? `保存エラー（${res.status}）`);
        return;
      }
      if (Array.isArray(json.slots)) {
        setSlots(json.slots);
      }
      // 保存完了後は開催日一覧へ戻す（router.refresh は一覧側で最新化するため不要）
      router.push("/admin/event-days");
    } finally {
      setBusy("idle");
    }
  }

  const saving = busy === "save";

  function renderRows(rows: EventDaySlotEditorRow[]) {
    // 現場向けには「6枠運用なら3行」「8枠運用なら4行」にするため、非有効枠は非表示にする。
    // 旧データ（3+3 等）では行ごとの有効チェックも必要なので、4+4 でないときは全行表示する。
    const sorted = sortSlotsByCode(rows);
    const visible =
      morning.length === 4 && afternoon.length === 4
        ? sorted.filter((s) => s.is_active)
        : sorted;
    if (visible.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-zinc-500">枠がありません</p>
      );
    }
    return (
      <div className="divide-y divide-zinc-100">
        {visible.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4"
          >
            <div className="min-w-0 sm:w-24 sm:pb-1.5">
              <p className="text-sm font-medium text-zinc-900">
                {eventSlotLabelJa(s.slot_code, s.phase)}
              </p>
            </div>
            <label className="block min-w-34">
              <span className="text-xs font-medium text-zinc-500">開始</span>
              <DateInputWithPicker
                type="time"
                disabled={!editable}
                value={timeInputValue(s.start_time)}
                onChange={(e) =>
                  updateSlot(s.id, {
                    start_time: `${e.target.value}:00`,
                  })
                }
                className="mt-0.5 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-100"
              />
            </label>
            <label className="block min-w-34">
              <span className="text-xs font-medium text-zinc-500">終了</span>
              <DateInputWithPicker
                type="time"
                disabled={!editable}
                value={timeInputValue(s.end_time)}
                onChange={(e) =>
                  updateSlot(s.id, { end_time: `${e.target.value}:00` })
                }
                className="mt-0.5 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-100"
              />
            </label>
            {showRowActiveCheckbox ? (
              <label className="flex items-center gap-2 pb-0.5 sm:pb-1.5">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={s.is_active}
                  onChange={(e) =>
                    updateSlot(s.id, { is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-800">有効（予約・編成）</span>
              </label>
            ) : null}
            {s.is_locked ? (
              <span className="text-xs text-amber-800">枠ロック中</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-950 sm:text-sm">
        <p className="font-medium text-sky-950">枠運用について</p>
        <p className="mt-1">{EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA}</p>
        {mutationMode === "normal" ? (
          <p className="mt-2 text-sky-900">
            アクティブな予約が1件でもある開催日では、通常の枠画面からの編集はできません（予約がある場合の変更は「枠の強制変更」画面から）。
          </p>
        ) : (
          <p className="mt-2 font-medium text-sky-950">
            保存は予約がある場合の強制変更用です。必要最小限の修正にとどめてください。
          </p>
        )}
      </div>

      {!countsPolicyOk ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 sm:text-sm">
          いまの枠数（午前 {morning.length}・午後 {afternoon.length}
          ）は標準の「4+4」に一致しません。運営にご相談ください。
        </p>
      ) : null}

      {countsPolicyOk && operationalSixEight !== null ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3 sm:px-4 sm:py-3.5">
          <h2 className="text-sm font-medium text-emerald-950">枠運用の選択</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-950/90 sm:text-sm">
            公開の予約フォームとマッチング編成に載せる枠数を「6枠」または「8枠」から選びます
            （6枠のときは各フェーズの4枠目を対象外にします。DBの枠行は残ります）。
          </p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-950">
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "six"}
                onChange={() => {
                  setSlots((prev) => applyOperationalSixEight(prev, "six"));
                }}
                className="h-4 w-4 border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              6枠運用（各フェーズの4枠目は対象外）
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-950">
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "eight"}
                onChange={() => {
                  setSlots((prev) => applyOperationalSixEight(prev, "eight"));
                }}
                className="h-4 w-4 border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              8枠運用（4枠すべてを対象）
            </label>
          </div>
          {operationalSixEight === "custom" ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-900 sm:text-sm">
              標準の6枠／8枠以外の組み合わせになっています。上のどちらかを選んで標準に戻してください。
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-3 py-2.5">
          <h2 className="text-sm font-medium text-zinc-800">
            {phaseLabelJa("morning")}（{morning.filter((s) => s.is_active).length} 枠）
          </h2>
        </div>
        {renderRows(morning)}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-3 py-2.5">
          <h2 className="text-sm font-medium text-zinc-800">
            {phaseLabelJa("afternoon")}（{afternoon.filter((s) => s.is_active).length} 枠）
          </h2>
        </div>
        {renderRows(afternoon)}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="min-h-5 sm:order-2 sm:text-right"
          aria-live="polite"
        >
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!editable || saving}
          onClick={() => void handleSave()}
          className="min-h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
        >
          {saving ? <InlineSpinner variant="onDark" /> : null}
          {saving ? "保存中…" : "時刻・運用を保存"}
        </button>
      </div>
    </div>
  );
}
