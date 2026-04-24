"use client";

/** 枠の時刻の編集と「6枠運用／8枠運用」の切替（API 連携）。 */
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  eightSlotTimesByCode,
  sixSlotTimesByCode,
} from "@/domains/event-days/default-slots";
import { eventDaySlotPhaseCountsOk } from "@/lib/event-days/event-day-slot-count-policy";
import { eventSlotLabelJa, slotCodeOrderKey } from "@/lib/admin/operator-display";
import Link from "next/link";
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

/** 予約締切を過去とみなすか（未設定・不正なら false） */
function isReservationDeadlinePassed(iso: string): boolean {
  const t = iso.trim() ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return Date.now() >= t;
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

/** 標準テンプレの時刻を slot_code で上書き */
function patchSlotTimesFromCodeMap(
  prev: EventDaySlotEditorRow[],
  byCode: ReadonlyMap<string, { startTime: string; endTime: string }>
): EventDaySlotEditorRow[] {
  return prev.map((s) => {
    const t = byCode.get(s.slot_code);
    if (!t) return s;
    return { ...s, start_time: t.startTime, end_time: t.endTime };
  });
}

/** 6枠へ: 1〜3枠は1時間単位テンプレ、4枠目は45分テンプレのまま無効化 */
function applySixWithStandardSlotTimes(prev: EventDaySlotEditorRow[]): EventDaySlotEditorRow[] {
  const patched = patchSlotTimesFromCodeMap(prev, sixSlotTimesByCode());
  return applyOperationalSixEight(patched, "six");
}

/** 8枠へ: 全枠を45分連続テンプレに揃えてから有効化 */
function applyEightWithStandardSlotTimes(prev: EventDaySlotEditorRow[]): EventDaySlotEditorRow[] {
  const patched = patchSlotTimesFromCodeMap(prev, eightSlotTimesByCode());
  return applyOperationalSixEight(patched, "eight");
}

export function SlotsEditorClient({
  eventDayId,
  initialSlots,
  editable,
  mutationMode = "normal",
  activeReservationCount = 0,
  reservationDeadlineAt = "",
}: {
  eventDayId: string;
  initialSlots: EventDaySlotEditorRow[];
  editable: boolean;
  /** `force` のときは `/slots/force` API と `acknowledgeReservationRisk` を使う */
  mutationMode?: "normal" | "force";
  /** アクティブ予約件数（通常モードで編集不可の理由表示に使用） */
  activeReservationCount?: number;
  /** 開催日の予約締切（ISO）。過去なら保存前に確認 */
  reservationDeadlineAt?: string;
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
    if (isReservationDeadlinePassed(reservationDeadlineAt)) {
      const ok = window.confirm(
        "予約締切の日時をすでに過ぎています。この内容で枠（時刻・運用）を保存してもよいですか？\n\n" +
          "（開催日のステータスはここでは自動では変わりません。必要なら開催日詳細の締切取りこぼし処理などをご確認ください。）"
      );
      if (!ok) return;
    }
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

  function renderSlotRow(s: EventDaySlotEditorRow, opts?: { muted?: boolean }) {
    const muted = opts?.muted ?? false;
    const readOnlyRow = !editable;
    return (
      <div
        key={s.id}
        className={`flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 ${
          muted ? "bg-zinc-50/70" : readOnlyRow ? "bg-zinc-50/50" : ""
        } ${readOnlyRow ? "opacity-[0.92]" : ""}`}
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
            step={60}
            disabled={!editable}
            value={timeInputValue(s.start_time)}
            onChange={(e) =>
              updateSlot(s.id, {
                start_time: `${e.target.value}:00`,
              })
            }
            className="mt-0.5 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>
        <label className="block min-w-34">
          <span className="text-xs font-medium text-zinc-500">終了</span>
          <DateInputWithPicker
            type="time"
            step={60}
            disabled={!editable}
            value={timeInputValue(s.end_time)}
            onChange={(e) =>
              updateSlot(s.id, { end_time: `${e.target.value}:00` })
            }
            className="mt-0.5 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
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
              className="h-4 w-4 rounded border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-sm text-zinc-800">有効（予約・編成）</span>
          </label>
        ) : null}
        {s.is_locked ? (
          <span className="text-xs font-medium text-zinc-600">枠ロック中</span>
        ) : null}
      </div>
    );
  }

  function renderRows(
    rows: EventDaySlotEditorRow[],
    slotOperationalMode: OperationalSixEight | null
  ) {
    const sorted = sortSlotsByCode(rows);
    const splitFourEach =
      morning.length === 4 && afternoon.length === 4 && !showRowActiveCheckbox;
    const activeRows = splitFourEach ? sorted.filter((s) => s.is_active) : sorted;
    /** 通常（各3枠）では4枠目を一覧に出さない（DB上は保持し、8枠に切替で表示） */
    const inactiveRows =
      splitFourEach && slotOperationalMode === "six"
        ? []
        : splitFourEach
          ? sorted.filter((s) => !s.is_active)
          : [];

    if (activeRows.length === 0 && inactiveRows.length === 0) {
      return <p className="px-3 py-4 text-sm text-zinc-500">枠がありません</p>;
    }

    return (
      <>
        {activeRows.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {activeRows.map((s) => renderSlotRow(s))}
          </div>
        ) : (
          <p className="px-3 py-4 text-sm text-zinc-500">枠がありません</p>
        )}
        {inactiveRows.length > 0 ? (
          <div className="border-t border-dashed border-zinc-200 bg-zinc-50/50">
            <p className="px-3 pt-3 text-xs leading-relaxed text-zinc-600">
              6枠運用では次の行は予約・編成の対象外ですが、8枠に切り替えたときの時刻を保持します。8枠にすると45分テンプレに揃います。昼休憩（12:00–13:00）は枠を置きません。
            </p>
            <div className="divide-y divide-zinc-100">
              {inactiveRows.map((s) => renderSlotRow(s, { muted: true }))}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-100 bg-sky-50/20 px-3 py-3 text-xs leading-relaxed text-zinc-700 sm:px-4 sm:py-3.5 sm:text-sm">
        <p className="text-sm font-semibold text-zinc-800">枠運用について</p>
        <div className="mt-2 whitespace-pre-line text-zinc-600">
          {`この開催日の試合枠の時刻と運用（6枠／8枠）を設定します。

・6枠：午前3枠・午後3枠
・8枠：午前4枠・午後4枠（初期は45分刻み）
・12:00–13:00は昼休憩のため枠を置きません`}
        </div>
        {mutationMode === "normal" && activeReservationCount > 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 sm:px-4"
          >
            <p className="text-sm font-semibold text-amber-950">
              有効な予約が {activeReservationCount} 件あります（通常は編集・保存できません）
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-900/95 sm:text-sm">
              現在の枠と時刻は下の一覧で確認できます。やむを得ない変更は「枠の強制変更」から別画面で行います（確認あり）。
            </p>
            <Link
              href={`/admin/event-days/${eventDayId}/slots/force`}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-green-800/20 bg-green-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 sm:w-auto sm:min-w-48"
            >
              枠の強制変更へ進む
            </Link>
          </div>
        ) : mutationMode === "normal" && !editable && activeReservationCount === 0 ? (
          <p className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-2.5 py-2 text-xs leading-relaxed text-zinc-600 sm:text-sm">
            開催日の状態のため、この一覧からは保存できません（参照のみ）。
          </p>
        ) : mutationMode === "normal" ? (
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 sm:text-sm">
            有効な予約がないときだけ、この一覧から保存できます。
          </p>
        ) : (
          <p className="mt-2 rounded-lg border border-green-100 bg-emerald-50/40 px-2.5 py-2 text-xs font-medium leading-relaxed text-zinc-700 sm:text-sm">
            強制変更モードです。必要最小限の修正にとどめてください。
          </p>
        )}
      </div>

      {!countsPolicyOk ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-950 sm:text-sm">
          いまの枠数（午前 {morning.length}・午後 {afternoon.length}
          ）は標準の「4+4」に一致しません。運営にご相談ください。
        </p>
      ) : null}

      {countsPolicyOk && operationalSixEight !== null ? (
        <section className="rounded-xl border border-emerald-100/90 bg-emerald-50/25 px-3 py-3 sm:px-4 sm:py-3.5">
          <h2 className="text-sm font-semibold text-zinc-800">枠運用の選択</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 sm:text-sm">
            6枠か8枠かを選びます（編集できるときだけ切り替え可能）。
          </p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <label
              className={`inline-flex items-center gap-2 text-sm text-zinc-800 ${
                editable ? "cursor-pointer" : "cursor-not-allowed opacity-80"
              }`}
            >
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "six"}
                onChange={() => {
                  setSlots((prev) => applySixWithStandardSlotTimes(prev));
                }}
                className="h-4 w-4 border-zinc-300 text-green-700 focus:ring-green-600 disabled:cursor-not-allowed disabled:opacity-55"
              />
              6枠（午前3・午後3）
            </label>
            <label
              className={`inline-flex items-center gap-2 text-sm text-zinc-800 ${
                editable ? "cursor-pointer" : "cursor-not-allowed opacity-80"
              }`}
            >
              <input
                type="radio"
                name="oper-six-eight-slots"
                disabled={!editable}
                checked={operationalSixEight === "eight"}
                onChange={() => {
                  setSlots((prev) => applyEightWithStandardSlotTimes(prev));
                }}
                className="h-4 w-4 border-zinc-300 text-green-700 focus:ring-green-600 disabled:cursor-not-allowed disabled:opacity-55"
              />
              8枠（午前4・午後4）
            </label>
          </div>
          {operationalSixEight === "custom" ? (
            <p className="mt-2 rounded-md border border-amber-100 bg-amber-50/40 px-2.5 py-2 text-xs leading-relaxed text-zinc-700 sm:text-sm">
              6枠／8枠の標準と異なる状態です。上のどちらかを選ぶと標準に戻せます。
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
        {renderRows(morning, operationalSixEight)}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-3 py-2.5">
          <h2 className="text-sm font-medium text-zinc-800">
            {phaseLabelJa("afternoon")}（{afternoon.filter((s) => s.is_active).length} 枠）
          </h2>
        </div>
        {renderRows(afternoon, operationalSixEight)}
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
