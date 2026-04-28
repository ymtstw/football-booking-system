"use client";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import {
  assignmentTypeShortLabelJa,
  buildMatchVsLines,
  formatAdminIdTail,
  teamDisplayNameBare,
  teamGradeCategoryDetailJa,
} from "@/lib/admin/operator-display";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { formatSlashDateJa } from "@/lib/dates/tokyo-day-bounds";
import {
  formatMatchingWarningsForDisplay,
  formatMatchingWarningsShortLabel,
} from "@/lib/matching/matching-warning-labels-ja";

import { PreDayAdjustPanel } from "./pre-day-adjust-panel";

type EventDayJson = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
  reservation_deadline_at?: string | null;
};

/** 予約締切の DB 時刻（UTC 想定の ISO）を過ぎているか（クライアントの現在時刻で判定） */
function isReservationDeadlinePassedClient(
  deadlineIso: string | null | undefined
): boolean {
  const t = deadlineIso?.trim();
  if (!t) return false;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
}

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
  /** 1〜6。未取得・範囲外は null（旧レスポンスでは欠ける場合あり） */
  representativeGradeYear?: number | null;
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
  representativeGradeYear?: number | null;
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
  /** 全日 target 未達（編成メタ拡張・旧データでは無い場合あり） */
  targetPlayShortfallReservationIds?: string[];
  notes: string[];
};

type UnifiedSlotRow = {
  slot: SlotOverviewJson;
  typeStr: string;
  matchLine1: string;
  matchLine2: string | null;
  /** 午前希望外など補足（一覧では title にだけ出す） */
  matchTitle: string | null;
  refStr: string;
  warnShort: string;
  warnDetailTitle: string | null;
};

function buildUnifiedSlotRows(
  slotsOverview: SlotOverviewJson[],
  assignmentBySlotId: Map<string, AssignmentJson>
): UnifiedSlotRow[] {
  return slotsOverview.map((slot) => {
    const asg = assignmentBySlotId.get(slot.slotId);
    let typeStr = "—";
    let matchLine1 = "—";
    let matchLine2: string | null = null;
    let matchTitle: string | null = null;
    let refStr = "—";
    let warnShort = "—";
    let warnDetailTitle: string | null = null;

    if (asg) {
      typeStr = assignmentTypeShortLabelJa(asg.assignmentType);
      const built = buildMatchVsLines(
        teamDisplayNameBare(asg.sideA),
        teamDisplayNameBare(asg.sideB),
        teamGradeCategoryDetailJa(asg.sideA),
        teamGradeCategoryDetailJa(asg.sideB)
      );
      matchLine1 = built.matchLine1;
      matchLine2 = built.matchLine2;
      refStr = asg.referee ? teamDisplayNameBare(asg.referee) : "—";
      warnShort = formatMatchingWarningsShortLabel(asg.warningJson);
      const detail = formatMatchingWarningsForDisplay(asg.warningJson);
      warnDetailTitle = detail !== "—" ? detail : null;
    } else if (slot.phase === "morning") {
      const occ = slot.morningOccupants;
      if (occ.length > 0) {
        typeStr = "既予約";
        const n0 = occ[0]!;
        const n1 = occ[1];
        if (occ.length >= 2 && n1) {
          const built = buildMatchVsLines(
            teamDisplayNameBare(n0),
            teamDisplayNameBare(n1),
            teamGradeCategoryDetailJa(n0),
            teamGradeCategoryDetailJa(n1)
          );
          matchLine1 =
            occ.length > 2
              ? `${built.matchLine1}（ほか${occ.length - 2}）`
              : built.matchLine1;
          matchLine2 = built.matchLine2;
        } else {
          const built = buildMatchVsLines(
            teamDisplayNameBare(n0),
            "—",
            teamGradeCategoryDetailJa(n0),
            ""
          );
          matchLine1 = built.matchLine1;
          matchLine2 = built.matchLine2;
        }
        const notes = occ
          .map((o) => o.morningMatchNote)
          .filter((x): x is string => Boolean(x?.trim()));
        if (notes.length) matchTitle = notes.join(" ");
      }
    }

    return {
      slot,
      typeStr,
      matchLine1,
      matchLine2,
      matchTitle,
      refStr,
      warnShort,
      warnDetailTitle,
    };
  });
}

/** 対戦：1行目チーム名 vs、2行目学年・カテゴリ */
function MatchVsDisplay({
  line1,
  line2,
  title,
}: {
  line1: string;
  line2: string | null;
  title?: string | null;
}) {
  const showLine2 = Boolean(line2?.trim()) && line1 !== "—";
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={title ?? undefined}>
      <span className="wrap-break-word text-zinc-900">{line1}</span>
      {showLine2 ? (
        <span className="wrap-break-word text-xs leading-snug text-zinc-500">{line2}</span>
      ) : null}
    </div>
  );
}

/** 全日の枠を時間順の1表にし、種別・A/B・審判・警告をまとめて表示 */
/** 一覧では利用しないダミー枠（is_active = false）を出さない */
function slotsOverviewForMatchTable(slots: SlotOverviewJson[]): SlotOverviewJson[] {
  return slots.filter((s) => s.isActive !== false);
}

/** 一覧の時間列（午前1 等のラベルは出さず時刻のみ） */
function slotTimeRangeJa(slot: SlotOverviewJson): string {
  const t0 = slot.startTime?.slice(0, 5) ?? "";
  const t1 = slot.endTime?.slice(0, 5) ?? "";
  if (t0 && t1) return `${t0}–${t1}`;
  return t0 || t1 || "—";
}

function formatHmShort(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** 試合一覧で、直前行が午前・当行が午後のとき、その前に昼休憩行を挟む */
function shouldInsertLunchBreakBeforeUnifiedRow(rows: UnifiedSlotRow[], idx: number): boolean {
  if (idx <= 0) return false;
  const prev = rows[idx - 1]!.slot;
  const curr = rows[idx]!.slot;
  return prev.phase === "morning" && curr.phase === "afternoon";
}

/** 午前最終枠の終了〜午後先頭枠の開始（データが揃わないときは null） */
function lunchBreakTimeLabelUnified(rows: UnifiedSlotRow[], idx: number): string | null {
  if (!shouldInsertLunchBreakBeforeUnifiedRow(rows, idx)) return null;
  const prev = rows[idx - 1]!.slot;
  const curr = rows[idx]!.slot;
  const endM = prev.endTime?.trim();
  const startA = curr.startTime?.trim();
  if (!endM || !startA) return null;
  return `${formatHmShort(endM)}–${formatHmShort(startA)}`;
}

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

  const slotsForTable = useMemo(
    () => slotsOverviewForMatchTable(slotsOverview),
    [slotsOverview]
  );

  const slotRows = useMemo(
    () => buildUnifiedSlotRows(slotsForTable, assignmentBySlotId),
    [slotsForTable, assignmentBySlotId]
  );

  if (slotsForTable.length === 0) {
    return (
      <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-800">試合一覧</h2>
        <p className="mt-2">
          {slotsOverview.length === 0
            ? "時間枠のデータがありません。"
            : "表示できる時間枠がありません。"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-800">試合一覧</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        時間・対戦・審判を一覧しています。長い注意の詳細は行にカーソルを合わせると確認できます。
      </p>

      <div className="mt-3 space-y-4 md:hidden">
        {slotRows.flatMap((row, idx) => {
          const { slot, typeStr, matchLine1, matchLine2, matchTitle, refStr, warnShort, warnDetailTitle } = row;
          const lunchLabel = lunchBreakTimeLabelUnified(slotRows, idx);
          const nodes: ReactNode[] = [];
          if (shouldInsertLunchBreakBeforeUnifiedRow(slotRows, idx)) {
            nodes.push(
              <div
                key={`lunch-${slot.slotId}`}
                className="rounded-lg border border-dashed border-zinc-300/85 bg-zinc-100/35 px-3 py-2 text-center ring-1 ring-zinc-200/40"
              >
                <p className="text-[11px] font-medium text-zinc-500">
                  昼休憩
                  {lunchLabel ? (
                    <span className="ml-1.5 tabular-nums font-normal text-zinc-400">{lunchLabel}</span>
                  ) : null}
                </p>
              </div>
            );
          }
          nodes.push(
            <article
              key={slot.slotId}
              className="rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/75"
            >
              <div className="border-b border-zinc-200/80 pb-2">
                <p className="min-w-0 text-sm font-semibold tabular-nums text-zinc-900 wrap-break-word">
                  {slotTimeRangeJa(slot)}
                </p>
              </div>
              <dl className="mt-3 space-y-2 text-sm text-zinc-800">
                <div>
                  <dt className="text-xs font-medium text-zinc-500">種別</dt>
                  <dd className="mt-0.5 wrap-break-word">{typeStr}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">対戦</dt>
                  <dd className="mt-0.5 min-w-0">
                    <MatchVsDisplay line1={matchLine1} line2={matchLine2} title={matchTitle} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">審判</dt>
                  <dd className="mt-0.5 wrap-break-word text-zinc-700">{refStr}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">注意</dt>
                  <dd
                    className="mt-0.5 wrap-break-word text-xs text-amber-900"
                    title={warnDetailTitle ?? undefined}
                  >
                    {warnShort}
                  </dd>
                </div>
              </dl>
            </article>
          );
          return nodes;
        })}
      </div>

      <div className="mt-3 hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200/90 bg-zinc-50/40 shadow-inner [-webkit-overflow-scrolling:touch] md:block">
        <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-left text-sm text-zinc-800 sm:min-w-[40rem]">
          <colgroup>
            <col style={{ width: "5rem" }} />
            <col style={{ width: "3.75rem" }} />
            <col style={{ width: "50%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr className="text-xs font-semibold tracking-wide text-zinc-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/80">
              <th className="rounded-tl-lg bg-zinc-100/95 py-2.5 pl-3 pr-2 align-bottom">時間</th>
              <th className="bg-zinc-100/95 py-2.5 pr-2 align-bottom">種別</th>
              <th className="min-w-0 bg-zinc-100/95 py-2.5 pr-3 align-bottom">対戦</th>
              <th className="min-w-0 bg-zinc-100/95 py-2.5 pr-2 align-bottom">審判</th>
              <th className="min-w-0 rounded-tr-lg bg-zinc-100/95 py-2.5 pr-3 align-bottom">注意</th>
            </tr>
          </thead>
          <tbody className="bg-transparent">
            {slotRows.flatMap((row, idx) => {
              const { slot, typeStr, matchLine1, matchLine2, matchTitle, refStr, warnShort, warnDetailTitle } = row;
              const lunchLabel = lunchBreakTimeLabelUnified(slotRows, idx);
              const rows: ReactNode[] = [];
              if (shouldInsertLunchBreakBeforeUnifiedRow(slotRows, idx)) {
                rows.push(
                  <tr
                    key={`lunch-${slot.slotId}`}
                    className="rounded-lg bg-zinc-100/55 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-zinc-200/65"
                  >
                    <td colSpan={5} className="rounded-lg py-2 px-3 text-center">
                      <span className="text-[11px] font-medium text-zinc-500">昼休憩</span>
                      {lunchLabel ? (
                        <span className="ml-2 text-[11px] tabular-nums font-normal text-zinc-400">
                          {lunchLabel}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              }
              rows.push(
                <tr
                  key={slot.slotId}
                  className="align-top rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/75"
                >
                  <td className="rounded-l-lg py-3 pl-3 pr-2 align-top text-xs leading-tight text-zinc-600">
                    <span className="whitespace-nowrap tabular-nums font-medium text-zinc-700">
                      {slotTimeRangeJa(slot)}
                    </span>
                  </td>
                  <td className="py-3 pr-2 align-top text-xs text-zinc-700">{typeStr}</td>
                  <td className="min-w-0 py-3 pr-3 align-top">
                    <MatchVsDisplay line1={matchLine1} line2={matchLine2} title={matchTitle} />
                  </td>
                  <td className="min-w-0 max-w-40 py-3 pr-3 align-top wrap-break-word text-zinc-700 sm:max-w-48">
                    {refStr}
                  </td>
                  <td
                    className="min-w-0 max-w-32 rounded-r-lg py-3 pr-3 align-top wrap-break-word text-xs text-amber-900 sm:max-w-44"
                    title={warnDetailTitle ?? undefined}
                  >
                    {warnShort}
                  </td>
                </tr>
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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
    case "cancelled_operational":
    case "cancelled_minimum":
      return "border-red-300 bg-red-50 text-red-950";
    default:
      return "border-zinc-300 bg-white text-zinc-800";
  }
}

export type PreDayResultsTab = "matches" | "adjust";

export function PreDayResultsClient({
  initialDate,
  initialTab,
  initialNotificationsFocus,
}: {
  initialDate: string;
  initialTab: PreDayResultsTab;
  initialNotificationsFocus: "failed" | null;
}) {
  const [tab, setTab] = useState<PreDayResultsTab>(initialTab);
  const [date, setDate] = useState(() => initialDate);
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
        setLoadError(json.error ?? "試合表を読み込めませんでした。日付と通信を確認してください。");
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

  // `?date=` やサーバー既定（東京の直近開催日）に合わせて入力を同期
  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  // 対戦表タブのとき、開催日が決まったら一覧を自動取得（初回・日付変更・タブ切替）
  useEffect(() => {
    if (tab !== "matches") return;
    void loadMatches();
  }, [tab, date, loadMatches]);

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
            "すでに自動作成した試合表があります。「自動作成した内容を取り消す」で取り消してから、もう一度お試しください。"
        );
        return;
      }
      if (!res.ok) {
        setActionMessage(json.error ?? "試合表の自動作成に失敗しました。しばらくしてから再度お試しください。");
        return;
      }
      if (json.meta) setLastMeta(json.meta);
      setActionMessage(
        `試合表を作成しました（試合 ${json.assignmentCount ?? "—"} 件）。一覧を更新しました。`
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
      "自動作成で追加した「午前の試合（補完）」と「午後の試合」を削除します。",
      "自動で追加された試合だけが対象です。予約データは削除されません。",
      "",
      "午前に組まれた確定の試合の行は残ります（審判のみクリアされます）。",
      "",
      afternoonListed > 0 || morningFillListed > 0
        ? `（一覧では午前の補完 ${morningFillListed} 件・午後 ${afternoonListed} 件を表示中です）`
        : "（一覧に行がなくても、対象となるデータは削除されます）",
      "",
      "・開催日は「受付終了」に戻ります（試合表を自動作成する前の状態に近づきます。一般からの新規予約はまだできません）",
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
        setActionMessage(json.error ?? "取り消しに失敗しました。画面を再読み込みしてから再度お試しください。");
        return;
      }
      const refCleared = json.clearedMorningFixedRefereeCount ?? 0;
      const refPart =
        refCleared > 0
          ? ` 午前の試合の審判を ${refCleared} 件クリアしました。`
          : "";
      setActionMessage(
        `自動作成した内容を取り消しました。午前の補完 ${json.deletedMorningFillCount ?? 0} 件・午後 ${json.deletedAfternoonCount ?? 0} 件を削除し、試合表の自動作成を取り消しました。${refPart}一般からの予約の再受付にはなっていません。`
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
  const deadlinePassedAwaitingLock = Boolean(
    data &&
      data.eventDay.status === "open" &&
      isReservationDeadlinePassedClient(data.eventDay.reservation_deadline_at)
  );

  const afternoonRows = data?.assignments.filter((a) => a.matchPhase === "afternoon") ?? [];
  const morningRows = data?.assignments.filter((a) => a.matchPhase === "morning") ?? [];
  const hasManualAdjustedMatch = data?.assignments.some((a) => a.manualOverride) ?? false;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">試合表・編成</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          開催日の試合表を確認・調整します。
        </p>
      </div>

      <div
        className="max-w-xl rounded-xl border border-zinc-200 bg-zinc-100/90 p-1 shadow-inner"
        role="tablist"
        aria-label="試合表・編成のタブ（自動作成／手動調整）"
      >
        <div className="flex min-h-10 gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "matches"}
            onClick={() => setTab("matches")}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors sm:px-4 ${
              tab === "matches"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200/80 hover:bg-zinc-50"
            }`}
          >
            自動作成
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "adjust"}
            onClick={() => setTab("adjust")}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors sm:px-4 ${
              tab === "adjust"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200/80 hover:bg-zinc-50"
            }`}
          >
            手動調整
          </button>
        </div>
      </div>

      {tab === "adjust" ? <PreDayAdjustPanel eventDate={date} /> : null}

      {tab === "matches" ? (
        <>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-48 sm:flex-initial">
          <span className="font-medium text-zinc-800">確認する開催日</span>
          <DateInputWithPicker
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 sm:w-auto"
          />
        </label>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => void loadMatches()}
            disabled={loading}
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:order-first sm:w-auto"
          >
            {loading ? "読込中…" : "表示を更新"}
          </button>
          {data?.eventDay?.id ? (
            <Link
              href={`/admin/event-days/${encodeURIComponent(data.eventDay.id)}`}
              className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50/90 px-3 text-sm font-normal text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-800 sm:w-auto"
            >
              この日の運営画面に進む
            </Link>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}

      {tab === "matches" && initialNotificationsFocus === "failed" ? (
        <section
          id="notifications-failed"
          className="scroll-mt-6 rounded-lg border border-red-200/80 bg-red-50/40 px-4 py-4 sm:px-5"
          aria-labelledby="failed-notif-title"
        >
          <h2 id="failed-notif-title" className="text-sm font-semibold text-red-950">
            送信エラーの確認
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-red-900/80">
            送信できなかったメールだけです。届いていないのにここが空なこともあります。宛先と内容を確認し、再送できる行は「このメールを再送する」から試してください。
          </p>
          <div className="mt-3">
            {!data?.eventDay?.id ? (
              <p className="text-sm text-red-900/80">
                {loadError
                  ? "開催日を読み込めないため、通知一覧は表示できません。"
                  : loading
                    ? "開催日の読込中です…"
                    : "開催日が未取得です。"}
              </p>
            ) : (
              <NotificationFailedRetryTable eventDayId={data.eventDay.id} />
            )}
          </div>
        </section>
      ) : null}

      {data ? (
        <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 border-b border-zinc-200/80 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-medium text-zinc-500">選択中の開催日</h2>
              <p className="mt-1 font-medium text-zinc-900">
                {formatSlashDateJa(data.eventDay.event_date)}
                <span className="text-zinc-600">（{data.eventDay.grade_band}）</span>
              </p>
              <p className="mt-2 text-sm text-zinc-800">
                開催状況：
                <span className="ml-1 font-medium text-zinc-900">
                  {eventDayStatusLabelJa(data.eventDay.status)}
                </span>
              </p>
              {data.eventDay.status === "open" && !deadlinePassedAwaitingLock ? (
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  現在は予約受付中のため、試合表の自動作成はできません。予約締切後に利用できます。
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {deadlinePassedAwaitingLock ? (
                  <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950">
                    締切日時は過ぎています（まだ受付終了に切り替わっていません）
                  </span>
                ) : null}
              </div>
              {deadlinePassedAwaitingLock ? (
                <div className="mt-2 max-w-2xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                  <p>
                    受付終了への切り替えは、毎日の自動処理か、
                    <Link
                      href={`/admin/event-days/${encodeURIComponent(data.eventDay.id)}`}
                      className="font-semibold text-amber-950 underline decoration-amber-800 underline-offset-2 hover:text-amber-900"
                    >
                      この日の運営画面
                    </Link>
                    から手動で進めてください。切り替わるまで<strong>試合表の自動作成はできません</strong>。
                  </p>
                </div>
              ) : null}
              {data.eventDay.status === "confirmed" ? (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-600">
                  「自動作成した内容を取り消す」で、自動で足した午前の補完と午後の試合を消して受付終了に戻せます。午前に確定した試合の行は残り、審判だけ消えます。予約内容は消えません。
                </p>
              ) : null}
            </div>
            <dl className="grid w-full min-w-0 shrink-0 grid-cols-1 gap-y-2 text-xs sm:max-w-sm sm:text-sm">
              <div>
                <dt className="text-zinc-500">午前の試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{morningRows.length} 件</dd>
              </div>
              <div>
                <dt className="text-zinc-500">午後の試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{afternoonRows.length} 件</dd>
              </div>
              <div>
                <dt className="text-zinc-500">
                  {data.matchingRun && hasManualAdjustedMatch
                    ? "自動作成の履歴"
                    : "自動作成"}
                </dt>
                <dd className="text-zinc-800">
                  {data.matchingRun ? (
                    hasManualAdjustedMatch ? (
                      "あり"
                    ) : (
                      "実行済み"
                    )
                  ) : (
                    <span className="text-zinc-500">なし</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">注意事項</dt>
                <dd className="text-zinc-800">
                  {data.matchingRun
                    ? data.matchingRun.warningCount > 0
                      ? `${data.matchingRun.warningCount} 件`
                      : "なし"
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3 rounded-md border border-zinc-200/80 bg-white/70 px-3 py-2 text-xs leading-relaxed text-zinc-700 sm:text-sm">
            <p className="font-medium text-zinc-800">この画面でできること</p>
            <p className="mt-1">
              予約締切後に、試合表を自動で作成できます。作成後は、必要に応じて試合の組み合わせや審判を調整できます。
            </p>
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void runMatching()}
              disabled={!canRun || actionBusy !== null}
              title={!canRun ? "受付を終了した開催日だけ、試合表を自動作成できます" : undefined}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:text-zinc-100 disabled:opacity-100 disabled:hover:bg-zinc-400 sm:w-auto"
            >
              {actionBusy === "run" ? "作成中…" : "試合表を自動作成する"}
            </button>
            <button
              type="button"
              onClick={() => void undoAfternoon()}
              disabled={!canUndo || actionBusy !== null}
              title={
                !canUndo
                  ? "開催が確定しているときだけ使えます"
                  : "自動で追加された試合だけを削除します。予約内容は削除されません。"
              }
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-700 bg-white px-4 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {actionBusy === "undo"
                ? "処理中…"
                : "自動作成した内容を取り消す"}
            </button>
          </div>
          {canUndo ? (
            <p className="mt-2 text-xs text-zinc-600">
              自動で追加された試合だけを削除します。予約内容は削除されません。
            </p>
          ) : null}
          {!canRun && !canUndo ? (
            <p className="mt-2 text-xs text-zinc-600">
              {deadlinePassedAwaitingLock
                ? "締切日時は過ぎていますが、まだ「公開中」のため試合表の自動作成はできません。"
                : status === "open"
                  ? "現在は予約受付中のため、試合表の自動作成はできません。予約締切後に利用できます。"
                  : "この状態では試合表の自動作成・取り消しは使えません（受付終了または開催確定のときに利用できます）。"}
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
          <h2 className="text-sm font-medium text-zinc-800">自動作成結果のサマリー</h2>
          <div className="mt-3 space-y-3 text-zinc-700">
            <div>
              <p className="text-xs font-medium text-zinc-500">午前・試合が組めなかった予約（件数）</p>
              <p className="mt-1 text-xs text-zinc-800">
                {lastMeta.unfilledMorningReservationIds.length} 件
              </p>
              {lastMeta.unfilledMorningReservationIds.length > 0 ? (
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  「手動調整」タブまたは「予約を確認」で該当チームを確認してください。
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">午後・枠に入れなかった予約（件数）</p>
              <p className="mt-1 text-xs text-zinc-800">
                {lastMeta.unfilledAfternoonReservationIds.length} 件
              </p>
              {lastMeta.unfilledAfternoonReservationIds.length > 0 ? (
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  「手動調整」タブまたは「予約を確認」で該当チームを確認してください。
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">1日の試合数が足りない可能性（件数）</p>
              <p className="mt-1 text-xs text-zinc-800">
                {lastMeta.targetPlayShortfallReservationIds?.length ?? 0} 件
              </p>
              {lastMeta.targetPlayShortfallReservationIds?.length ? (
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  試合表と予約人数を照らし合わせて確認してください。
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">メモ</p>
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
        </>
      ) : null}
    </div>
  );
}
