"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventDayJson = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
};

type MatchingRunJson = {
  id: string;
  status: string;
  isCurrent: boolean;
  warningCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

type SideJson = {
  reservationId: string;
  teamName: string | null;
  strengthCategory: string | null;
  contactName: string | null;
  displayName: string | null;
  participantCount: number | null;
};

type AssignmentJson = {
  id: string;
  /** match_assignments.event_day_slot_id（枠行との突合せ用） */
  slotId?: string;
  matchPhase: string;
  assignmentType: string;
  status: string;
  warningJson: unknown;
  manualOverride: boolean;
  overrideReason: string | null;
  slot: {
    slotCode: string;
    phase: string;
    startTime: string;
    endTime: string;
  } | null;
  sideA: SideJson;
  sideB: SideJson;
  referee: SideJson | null;
};

type SlotOccupantJson = {
  reservationId: string;
  teamName: string | null;
  strengthCategory: string | null;
  displayName: string | null;
  /** 午前試合行がこの希望枠と異なる枠にあるときの一言（null は試合なしまたは同枠） */
  morningMatchNote?: string | null;
};

type AfternoonSlotAssignmentJson = {
  assignmentId: string;
  assignmentType: string;
  sideA: SideJson;
  sideB: SideJson;
  referee: SideJson | null;
};

type SlotOverviewJson = {
  slotId: string;
  slotCode: string;
  phase: string;
  startTime: string;
  endTime: string;
  isActive: boolean | null;
  morningOccupants: SlotOccupantJson[];
  afternoonAssignment: AfternoonSlotAssignmentJson | null;
};

type MatchesResponse = {
  eventDay: EventDayJson;
  matchingRun: MatchingRunJson | null;
  assignments: AssignmentJson[];
  slotsOverview: SlotOverviewJson[];
};

type BuildMeta = {
  unfilledMorningReservationIds: string[];
  unfilledAfternoonReservationIds: string[];
  notes: string[];
};

function todayLocalIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWarnings(w: unknown): string {
  if (Array.isArray(w)) return (w as string[]).join(", ");
  if (w == null) return "—";
  return String(w);
}

function teamLabel(s: SideJson): string {
  return s.teamName ?? s.displayName ?? s.reservationId.slice(0, 8) + "…";
}

function occupantLabel(o: SlotOccupantJson): string {
  return o.teamName ?? o.displayName ?? o.reservationId.slice(0, 8) + "…";
}

function occupantCellText(o: SlotOccupantJson): string {
  const base = occupantLabel(o);
  const cat = o.strengthCategory ? ` (${o.strengthCategory})` : "";
  const note = o.morningMatchNote ? ` — ${o.morningMatchNote}` : "";
  return `${base}${cat}${note}`;
}

/** 全日の枠を時間順の1表にし、種別・A/B・審判・警告をまとめて表示 */
function UnifiedSlotsTable({
  slotsOverview,
  assignments,
}: {
  slotsOverview: SlotOverviewJson[];
  assignments: AssignmentJson[];
}) {
  const assignmentBySlotId = useMemo(() => {
    const m = new Map<string, AssignmentJson>();
    for (const a of assignments) {
      if (a.slotId) m.set(a.slotId, a);
    }
    return m;
  }, [assignments]);

  if (slotsOverview.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-800">試合・枠一覧</h2>
        <p className="mt-2">枠データがありません。</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-800">試合・枠一覧（時間順）</h2>
      <p className="mt-1 text-xs text-zinc-500">
        午前・午後の全枠を1表にしています。試合行がある枠は種別・審判・警告を表示し、午前で行がないときは希望枠の予約をチーム列に出します（試合が別枠のときは注記を付けます）。
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-zinc-800">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500">
              <th className="whitespace-nowrap py-2 pr-3">枠</th>
              <th className="whitespace-nowrap py-2 pr-3">枠状態</th>
              <th className="whitespace-nowrap py-2 pr-3">種別</th>
              <th className="py-2 pr-3">チームA</th>
              <th className="py-2 pr-3">チームB</th>
              <th className="py-2 pr-3">審判</th>
              <th className="py-2">警告</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {slotsOverview.map((slot) => {
              const asg = assignmentBySlotId.get(slot.slotId);
              let typeStr = "—";
              let aStr = "—";
              let bStr = "—";
              let refStr = "—";
              let warnStr = "—";

              if (asg) {
                typeStr = asg.assignmentType;
                aStr = `${teamLabel(asg.sideA)}${asg.sideA.strengthCategory ? ` (${asg.sideA.strengthCategory})` : ""}`;
                bStr = `${teamLabel(asg.sideB)}${asg.sideB.strengthCategory ? ` (${asg.sideB.strengthCategory})` : ""}`;
                refStr = asg.referee ? teamLabel(asg.referee) : "—";
                warnStr = formatWarnings(asg.warningJson);
              } else if (slot.phase === "morning") {
                const occ = slot.morningOccupants;
                if (occ.length === 0) {
                  typeStr = "—";
                } else {
                  typeStr = "予約のみ";
                  aStr = occ[0] ? occupantCellText(occ[0]) : "—";
                  if (occ.length === 1) {
                    bStr = "—";
                  } else {
                    bStr = occ[1] ? occupantCellText(occ[1]) : "—";
                    if (occ.length > 2) {
                      bStr = `${bStr}（ほか${occ.length - 2}件）`;
                    }
                  }
                }
              } else {
                typeStr = "未編成";
              }

              return (
                <tr key={slot.slotId} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-zinc-600">
                    {slot.phase === "morning" ? "午前" : "午後"} {slot.slotCode}
                    <br />
                    <span className="text-xs text-zinc-400">
                      {slot.startTime?.slice(0, 5) ?? ""}–{slot.endTime?.slice(0, 5) ?? ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">
                    {slot.isActive === false ? (
                      <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                        無効
                      </span>
                    ) : (
                      <span className="text-zinc-500">有効</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs text-zinc-700">{typeStr}</td>
                  <td className="max-w-[140px] py-2 pr-3 wrap-break-word">{aStr}</td>
                  <td className="max-w-[140px] py-2 pr-3 wrap-break-word">{bStr}</td>
                  <td className="max-w-[120px] py-2 pr-3 wrap-break-word text-zinc-700">{refStr}</td>
                  <td className="max-w-[180px] py-2 text-xs text-amber-800">{warnStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** DB の event_days.status → 表示用 */
const EVENT_STATUS_JA: Record<string, string> = {
  draft: "下書き",
  open: "予約受付中",
  locked: "締切後（自動編成の実行可）",
  confirmed: "編成確定済み",
  cancelled_weather: "中止（天候）",
  cancelled_minimum: "中止（最少催行）",
};

function eventStatusJa(status: string): string {
  return EVENT_STATUS_JA[status] ?? status;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "locked":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "confirmed":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "open":
      return "border-sky-300 bg-sky-50 text-sky-950";
    case "draft":
      return "border-zinc-300 bg-zinc-100 text-zinc-800";
    case "cancelled_weather":
    case "cancelled_minimum":
      return "border-red-300 bg-red-50 text-red-950";
    default:
      return "border-zinc-300 bg-white text-zinc-800";
  }
}

export function PreDayResultsClient({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState(() => initialDate ?? todayLocalIsoDate());
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<"run" | "undo" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<BuildMeta | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/matches?date=${encodeURIComponent(date)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as Partial<MatchesResponse> & { error?: string };
      if (!res.ok) {
        setData(null);
        setLoadError(json.error ?? `読み込み失敗 (${res.status})`);
        return;
      }
      const full: MatchesResponse = {
        eventDay: json.eventDay!,
        matchingRun: json.matchingRun ?? null,
        assignments: json.assignments ?? [],
        slotsOverview: json.slotsOverview ?? [],
      };
      setData(full);
    } catch {
      setData(null);
      setLoadError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [date]);

  // `?date=YYYY-MM-DD` で開いたときだけ初回自動読込（日付変更のたびに API を叩かない）
  useEffect(() => {
    if (!initialDate) return;
    void loadMatches();
  }, [initialDate, loadMatches]);

  // 日付を変えたら直近の meta は別日の内容になりうるため消す
  useEffect(() => {
    setLastMeta(null);
  }, [date]);

  const runMatching = async () => {
    setActionBusy("run");
    setActionMessage(null);
    setLastMeta(null);
    try {
      const res = await fetch("/api/admin/matching/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventDate: date }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        meta?: BuildMeta;
        matchingRunId?: string;
        assignmentCount?: number;
      };

      if (res.status === 409) {
        setActionMessage(
          json.error ??
            "既に自動編成の結果があります。締切後へ戻してから再実行できます。"
        );
        return;
      }
      if (!res.ok) {
        setActionMessage(json.error ?? `編成失敗 (${res.status})`);
        return;
      }
      if (json.meta) setLastMeta(json.meta);
      setActionMessage(
        `編成を適用しました（割当 ${json.assignmentCount ?? "—"} 件）。下を再読込しました。`
      );
      await loadMatches();
    } catch {
      setActionMessage("通信エラーが発生しました");
    } finally {
      setActionBusy(null);
    }
  };

  const undoAfternoon = async () => {
    const afternoonListed = afternoonRows.length;
    const morningFillListed =
      data?.assignments.filter(
        (a) => a.matchPhase === "morning" && a.assignmentType === "morning_fill"
      ).length ?? 0;
    const confirmBody = [
      "自動編成で付けた「午前の補完（morning_fill）」と「午後の自動割当（afternoon_auto）」を削除します。",
      "予約データ・午前で2枠埋まって確定した試合（morning_fixed）は消えません（審判だけクリアされます）。",
      "",
      afternoonListed > 0 || morningFillListed > 0
        ? `（一覧では morning_fill ${morningFillListed} 件・午後 ${afternoonListed} 件表示中です）`
        : "（一覧に行がなくても、確定済みの該当データは削除対象です）",
      "",
      "・開催日は「締切後（locked）」に戻ります＝自動編成前に近い状態で、公開の新規予約はまだできません",
      "",
      "よろしいですか？",
    ].join("\n");
    if (!window.confirm(confirmBody)) {
      return;
    }
    setActionBusy("undo");
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/matching/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventDate: date }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        deletedAfternoonCount?: number;
        deletedMorningFillCount?: number;
        clearedMorningFixedRefereeCount?: number;
      };

      if (!res.ok) {
        setActionMessage(json.error ?? `解除に失敗しました (${res.status})`);
        return;
      }
      const refCleared = json.clearedMorningFixedRefereeCount ?? 0;
      const refPart =
        refCleared > 0
          ? ` morning_fixed の審判を ${refCleared} 件クリアしました。`
          : "";
      setActionMessage(
        `自動編成の巻き戻し: morning_fill ${json.deletedMorningFillCount ?? 0} 件・午後 ${json.deletedAfternoonCount ?? 0} 件を削除し、締切後（locked）へ戻しました。${refPart}予約の再受付にはなっていません。`
      );
      await loadMatches();
    } catch {
      setActionMessage("通信エラーが発生しました");
    } finally {
      setActionBusy(null);
    }
  };

  const status = data?.eventDay.status;
  const canRun = status === "locked";
  const canUndo = status === "confirmed";

  const afternoonRows = data?.assignments.filter((a) => a.matchPhase === "afternoon") ?? [];
  const morningRows = data?.assignments.filter((a) => a.matchPhase === "morning") ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">SCR-11 / 試合一覧・自動編成</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">前日確定・試合一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          開催日を選んで一覧を表示します。<strong className="font-medium">locked</strong> の日だけ自動編成を実行できます。
          確定済み（<strong className="font-medium">confirmed</strong>）の日は、巻き戻しで締切後に戻してから再実行できます（希望枠は予約のまま）。
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">開催日</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          />
        </label>
        <button
          type="button"
          onClick={() => void loadMatches()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "読込中…" : "一覧を表示"}
        </button>
      </div>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}

      {data ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm sm:p-5">
          <div className="flex flex-col gap-3 border-b border-zinc-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xs font-medium text-zinc-500">状態表示</h2>
              <p className="mt-1 font-medium text-zinc-900">
                {data.eventDay.event_date}{" "}
                <span className="text-zinc-600">（{data.eventDay.grade_band}）</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(data.eventDay.status)}`}
                >
                  {eventStatusJa(data.eventDay.status)}
                </span>
                <span className="font-mono text-xs text-zinc-500">{data.eventDay.status}</span>
              </div>
              {data.eventDay.status === "confirmed" ? (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-600">
                  下の「巻き戻し」で<strong className="font-medium text-zinc-800">締切後（locked）</strong>
                  に戻せます。消えるのは自動で付いた
                  <strong className="font-medium text-zinc-800"> morning_fill と午後（afternoon_auto）</strong>
                  だけです（
                  <strong className="font-medium text-zinc-800">morning_fixed</strong>
                  の審判は巻き戻しでクリアされます）。
                  <strong className="font-medium text-zinc-800"> 予約の午前希望枠</strong>
                  は <code className="rounded bg-zinc-100 px-1 font-mono text-[11px]">reservations</code>{" "}
                  のまま変わりません（一覧は試合行と希望の両方を参照します）。
                </p>
              ) : null}
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm">
              <div>
                <dt className="text-zinc-500">午前試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{morningRows.length} 件</dd>
              </div>
              <div>
                <dt className="text-zinc-500">午後試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{afternoonRows.length} 件</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">matching_run</dt>
                <dd className="text-zinc-800">
                  {data.matchingRun ? (
                    <>
                      あり · 警告 {data.matchingRun.warningCount} 件 ·{" "}
                      <span className="font-mono text-xs" title={data.matchingRun.id}>
                        {data.matchingRun.id.slice(0, 8)}…
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500">なし</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3 rounded-md border border-zinc-200/80 bg-white/70 px-3 py-2 text-xs leading-relaxed text-zinc-700 sm:text-sm">
            <p className="font-medium text-zinc-800">この画面でできること</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {status === "locked" ? (
                <li>自動編成で午後を組み、開催日を確定（confirmed）にします。</li>
              ) : null}
              {status === "confirmed" ? (
                <li>
                  <strong className="font-medium">自動編成の巻き戻し</strong>
                  で morning_fill と午後だけを消し「締切後（locked）」に戻せます。morning_fixed
                  は残りますが審判はクリアされます。希望枠は予約データのままです。
                </li>
              ) : null}
              {status !== "locked" && status !== "confirmed" ? (
                <li>自動編成・巻き戻しは、locked / confirmed のときのみ利用できます。</li>
              ) : null}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void runMatching()}
              disabled={!canRun || actionBusy !== null}
              title={!canRun ? "locked のときのみ実行できます" : undefined}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy === "run" ? "実行中…" : "自動編成を実行"}
            </button>
            <button
              type="button"
              onClick={() => void undoAfternoon()}
              disabled={!canUndo || actionBusy !== null}
              title={
                !canUndo
                  ? "confirmed のときのみ利用できます"
                  : "morning_fill と afternoon_auto を削除し locked に戻します。morning_fixed は残しますが審判はクリアします。予約（午前希望枠）は変更しません。"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-700 bg-white px-4 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy === "undo"
                ? "処理中…"
                : "巻き戻す（補完・午後を消して締切後へ／希望枠は予約のまま）"}
            </button>
          </div>
          {!canRun && !canUndo ? (
            <p className="mt-2 text-xs text-zinc-600">
              このステータスでは自動実行・巻き戻しボタンは無効です（locked / confirmed を想定）。
            </p>
          ) : null}
        </div>
      ) : null}

      {actionMessage ? (
        <p className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
          {actionMessage}
        </p>
      ) : null}

      {lastMeta ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:p-5">
          <h2 className="text-sm font-medium text-zinc-800">直近の編成メタ（meta）</h2>
          <div className="mt-3 space-y-3 text-zinc-700">
            <div>
              <p className="text-xs font-medium text-zinc-500">午前未ペア（予約ID）</p>
              <p className="mt-1 font-mono text-xs break-all">
                {lastMeta.unfilledMorningReservationIds.length
                  ? lastMeta.unfilledMorningReservationIds.join(", ")
                  : "なし"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">午後未割当（予約ID）</p>
              <p className="mt-1 font-mono text-xs break-all">
                {lastMeta.unfilledAfternoonReservationIds.length
                  ? lastMeta.unfilledAfternoonReservationIds.join(", ")
                  : "なし"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">notes</p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {lastMeta.notes.length ? (
                  lastMeta.notes.map((n, i) => <li key={i}>{n}</li>)
                ) : (
                  <li className="list-none text-zinc-500">なし</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <UnifiedSlotsTable slotsOverview={data.slotsOverview} assignments={data.assignments} />
      ) : null}
    </div>
  );
}
