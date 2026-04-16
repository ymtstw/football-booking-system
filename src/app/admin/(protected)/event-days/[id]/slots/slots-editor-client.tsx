"use client";

/** 枠の時刻・有効化の編集と午前／午後への枠追加（API 連携）。 */
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  canAppendEventDaySlotForPhase,
  EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA,
  eventDaySlotPhaseCountsOk,
} from "@/lib/event-days/event-day-slot-count-policy";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

/** 枠コード末尾の番号で並べ替え（MORNING_2 と MORNING_10 などに対応） */
function slotCodeOrderKey(slotCode: string): number {
  const m = slotCode.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]!, 10) : 0;
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
  const [busy, setBusy] = useState<
    "idle" | "save" | "addMorning" | "addAfternoon"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null
  );
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** 4+4 でも枠ごとの有効チェックを出す（標準は一括の6/8のみ） */
  const [showIndividualActiveToggles, setShowIndividualActiveToggles] =
    useState(false);

  function clearSaveSuccessTimer() {
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = null;
    }
  }

  useEffect(() => () => clearSaveSuccessTimer(), []);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  useEffect(() => {
    const m = initialSlots.filter((s) => s.phase === "morning");
    const a = initialSlots.filter((s) => s.phase === "afternoon");
    if (m.length !== 4 || a.length !== 4) {
      setShowIndividualActiveToggles(false);
    }
  }, [initialSlots]);

  const morning = useMemo(
    () => slots.filter((s) => s.phase === "morning"),
    [slots]
  );
  const afternoon = useMemo(
    () => slots.filter((s) => s.phase === "afternoon"),
    [slots]
  );

  const canAddMorning = useMemo(
    () => canAppendEventDaySlotForPhase(morning.length, afternoon.length, "morning"),
    [morning.length, afternoon.length]
  );
  const canAddAfternoon = useMemo(
    () => canAppendEventDaySlotForPhase(morning.length, afternoon.length, "afternoon"),
    [morning.length, afternoon.length]
  );
  const countsPolicyOk = useMemo(
    () => eventDaySlotPhaseCountsOk(morning.length, afternoon.length),
    [morning.length, afternoon.length]
  );

  const operationalSixEight = useMemo(
    () => deriveOperationalSixEight(morning, afternoon),
    [morning, afternoon]
  );

  const showRowActiveCheckbox = useMemo(() => {
    if (morning.length === 4 && afternoon.length === 4) {
      if (showIndividualActiveToggles) return true;
      return operationalSixEight === "custom";
    }
    return true;
  }, [
    morning.length,
    afternoon.length,
    showIndividualActiveToggles,
    operationalSixEight,
  ]);

  const slotsApiBase = `/api/admin/event-days/${eventDayId}/slots${
    mutationMode === "force" ? "/force" : ""
  }`;

  async function reloadFromApi() {
    const res = await fetch(`/api/admin/event-days/${eventDayId}/slots`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      slots?: EventDaySlotEditorRow[];
    };
    if (!res.ok) {
      throw new Error(json.error ?? `取得エラー（${res.status}）`);
    }
    if (Array.isArray(json.slots)) {
      setSlots(json.slots);
    }
    router.refresh();
  }

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
    clearSaveSuccessTimer();
    setSaveSuccessMessage(null);
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
      router.refresh();
      setSaveSuccessMessage("保存が完了しました。");
      clearSaveSuccessTimer();
      saveSuccessTimerRef.current = setTimeout(() => {
        setSaveSuccessMessage(null);
        saveSuccessTimerRef.current = null;
      }, 5000);
    } finally {
      setBusy("idle");
    }
  }

  async function handleAdd(phase: "morning" | "afternoon") {
    if (!editable) return;
    setError(null);
    clearSaveSuccessTimer();
    setSaveSuccessMessage(null);
    setBusy(phase === "morning" ? "addMorning" : "addAfternoon");
    try {
      const res = await fetch(slotsApiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mutationMode === "force"
            ? { phase, acknowledgeReservationRisk: true as const }
            : { phase }
        ),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `追加エラー（${res.status}）`);
        return;
      }
      await reloadFromApi();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再取得に失敗しました");
    } finally {
      setBusy("idle");
    }
  }

  const saving = busy === "save";
  const adding = busy === "addMorning" || busy === "addAfternoon";

  function renderRows(rows: EventDaySlotEditorRow[]) {
    if (rows.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-zinc-500">枠がありません</p>
      );
    }
    const sorted = sortSlotsByCode(rows);
    return (
      <div className="divide-y divide-zinc-100">
        {sorted.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4"
          >
            <div className="min-w-0 sm:w-36">
              <p className="text-xs font-medium text-zinc-500">枠コード</p>
              <p className="truncate font-mono text-sm text-zinc-900">
                {s.slot_code}
              </p>
            </div>
            <label className="block min-w-34">
              <span className="text-xs font-medium text-zinc-500">開始</span>
              <input
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
              <input
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
            ) : (
              <div className="pb-0.5 sm:pb-1.5">
                <p className="text-xs font-medium text-zinc-500">予約・編成</p>
                <p
                  className={
                    s.is_active
                      ? "mt-0.5 text-sm font-medium text-emerald-800"
                      : "mt-0.5 text-sm text-zinc-500"
                  }
                >
                  {s.is_active ? "対象" : "対象外"}
                </p>
              </div>
            )}
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
        <p className="font-medium text-sky-950">枠数のルール</p>
        <p className="mt-1">{EVENT_DAY_SLOT_COUNT_POLICY_HELP_JA}</p>
        <p className="mt-2 text-sky-900">
          枠を増やすときは「午前枠を追加」「午後枠を追加」を交互に使い、午前と午後の本数がずれないようにしてください。
          午前・午後が各4枠のとき、実質6枠で回すか8枠で回すかは下の「6枠運用／8枠運用」でまとめて切り替えられます（4枠目だけ予約・編成の対象から外します。DBの枠行は残ります）。
        </p>
        {mutationMode === "normal" ? (
          <p className="mt-2 text-sky-900">
            アクティブな予約が1件でもある開催日では、通常の枠画面からの編集・追加はできません（強制変更は別画面・別API）。
          </p>
        ) : (
          <p className="mt-2 font-medium text-sky-950">
            保存・追加は強制変更用 API に送信されます。必要最小限の修正にとどめてください。
          </p>
        )}
      </div>

      {!countsPolicyOk ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 sm:text-sm">
          いまの枠数（午前 {morning.length}・午後 {afternoon.length}
          ）は運用ルールの「3+3 または 4+4」に一致しません。枠の追加で揃えられる場合は調整し、難しい場合は運営にご相談ください。
        </p>
      ) : null}

      {countsPolicyOk && operationalSixEight !== null ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3 sm:px-4 sm:py-3.5">
          <h2 className="text-sm font-medium text-emerald-950">
            予約・編成で使う枠の本数（午前4・午後4のとき）
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-950/90 sm:text-sm">
            「有効」は、その枠を公開の予約フォームとマッチング編成に載せるかどうかです。
            多くの開催日では<strong className="font-medium text-emerald-950">4枠目だけ外す＝6枠運用</strong>
            になるため、ここで午前・午後まとめて切り替えられます。
          </p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-950">
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "eight"}
                onChange={() => {
                  setShowIndividualActiveToggles(false);
                  setSlots((prev) => applyOperationalSixEight(prev, "eight"));
                }}
                className="h-4 w-4 border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              8枠運用（各フェーズの4枠すべてが対象）
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-950">
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "six"}
                onChange={() => {
                  setShowIndividualActiveToggles(false);
                  setSlots((prev) => applyOperationalSixEight(prev, "six"));
                }}
                className="h-4 w-4 border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-50"
              />
              6枠運用（各フェーズの4枠目だけ対象外）
            </label>
          </div>
          {operationalSixEight === "custom" ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-900 sm:text-sm">
              午前・午後の「標準の6枠／8枠」以外の組み合わせになっています。標準に戻すには上のどちらかを選んでください。
            </p>
          ) : null}
          {editable &&
          (operationalSixEight === "six" || operationalSixEight === "eight") &&
          !showIndividualActiveToggles ? (
            <button
              type="button"
              className="mt-2 text-left text-xs font-medium text-emerald-900 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
              onClick={() => setShowIndividualActiveToggles(true)}
            >
              枠ごとに有効／無効を個別に変える（上級者向け）
            </button>
          ) : null}
          {editable &&
          showIndividualActiveToggles &&
          (operationalSixEight === "six" || operationalSixEight === "eight") ? (
            <button
              type="button"
              className="mt-1.5 text-left text-xs text-emerald-900/90 underline decoration-emerald-700/50 underline-offset-2 hover:text-emerald-950"
              onClick={() => setShowIndividualActiveToggles(false)}
            >
              一括の6／8表示に戻す（行のチェックを隠す）
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-zinc-800">
            {phaseLabelJa("morning")}（{morning.length} 枠）
          </h2>
          <button
            type="button"
            disabled={!editable || adding || !canAddMorning}
            onClick={() => void handleAdd("morning")}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "addMorning" ? (
              <span className="inline-flex items-center gap-2">
                <InlineSpinner variant="onLight" />
                追加中…
              </span>
            ) : (
              "午前枠を追加"
            )}
          </button>
        </div>
        {renderRows(morning)}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-zinc-800">
            {phaseLabelJa("afternoon")}（{afternoon.length} 枠）
          </h2>
          <button
            type="button"
            disabled={!editable || adding || !canAddAfternoon}
            onClick={() => void handleAdd("afternoon")}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "addAfternoon" ? (
              <span className="inline-flex items-center gap-2">
                <InlineSpinner variant="onLight" />
                追加中…
              </span>
            ) : (
              "午後枠を追加"
            )}
          </button>
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
          ) : saveSuccessMessage ? (
            <p className="text-sm font-medium text-emerald-700" role="status">
              {saveSuccessMessage}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!editable || saving || adding}
          onClick={() => void handleSave()}
          className="min-h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
        >
          {saving ? <InlineSpinner variant="onDark" /> : null}
          {saving ? "保存中…" : "時刻・有効化を保存"}
        </button>
      </div>
    </div>
  );
}
