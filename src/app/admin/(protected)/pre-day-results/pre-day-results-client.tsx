"use client";

import { NotificationFailedRetryTable } from "@/components/admin/notification-failed-retry-table";
import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";
import {
  assignmentTypeLabelJa,
  eventSlotLabelJa,
  formatAdminIdListTails,
  formatAdminIdTail,
} from "@/lib/admin/operator-display";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatMatchingWarningsForDisplay } from "@/lib/matching/matching-warning-labels-ja";

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
  /** 全日 target 未達（編成メタ拡張・旧データでは無い場合あり） */
  targetPlayShortfallReservationIds?: string[];
  notes: string[];
};

function teamLabel(s: SideJson): string {
  return s.teamName ?? s.displayName ?? formatAdminIdTail(s.reservationId);
}

function occupantLabel(o: SlotOccupantJson): string {
  return o.teamName ?? o.displayName ?? formatAdminIdTail(o.reservationId);
}

function occupantCellText(o: SlotOccupantJson): string {
  const base = occupantLabel(o);
  const cat = o.strengthCategory ? ` (${o.strengthCategory})` : "";
  const note = o.morningMatchNote ? ` — ${o.morningMatchNote}` : "";
  return `${base}${cat}${note}`;
}

type UnifiedSlotRow = {
  slot: SlotOverviewJson;
  typeStr: string;
  aStr: string;
  bStr: string;
  refStr: string;
  warnStr: string;
};

function buildUnifiedSlotRows(
  slotsOverview: SlotOverviewJson[],
  assignmentBySlotId: Map<string, AssignmentJson>
): UnifiedSlotRow[] {
  return slotsOverview.map((slot) => {
    const asg = assignmentBySlotId.get(slot.slotId);
    let typeStr = "—";
    let aStr = "—";
    let bStr = "—";
    let refStr = "—";
    let warnStr = "—";

    if (asg) {
      typeStr = assignmentTypeLabelJa(asg.assignmentType);
      aStr = `${teamLabel(asg.sideA)}${asg.sideA.strengthCategory ? ` (${asg.sideA.strengthCategory})` : ""}`;
      bStr = `${teamLabel(asg.sideB)}${asg.sideB.strengthCategory ? ` (${asg.sideB.strengthCategory})` : ""}`;
      refStr = asg.referee ? teamLabel(asg.referee) : "—";
      warnStr = formatMatchingWarningsForDisplay(asg.warningJson);
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

    return { slot, typeStr, aStr, bStr, refStr, warnStr };
  });
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

  const slotRows = useMemo(
    () => buildUnifiedSlotRows(slotsOverview, assignmentBySlotId),
    [slotsOverview, assignmentBySlotId]
  );

  if (slotsOverview.length === 0) {
    return (
      <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-800">試合・枠一覧</h2>
        <p className="mt-2">枠データがありません。</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-800">試合・枠一覧（時間順）</h2>
      <p className="mt-1 text-xs text-zinc-500">
        午前・午後の全枠を1表にしています。試合行がある枠は種別・審判・警告を表示し、午前で行がないときは希望枠の予約をチーム列に出します（試合が別枠のときは注記を付けます）。
      </p>

      <div className="mt-3 space-y-3 md:hidden">
        {slotRows.map(({ slot, typeStr, aStr, bStr, refStr, warnStr }) => (
          <article
            key={slot.slotId}
            className="rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-3.5 shadow-sm ring-1 ring-zinc-100/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200/80 pb-2">
              <p className="text-sm font-semibold text-zinc-900">
                {eventSlotLabelJa(slot.slotCode, slot.phase)}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {slot.startTime?.slice(0, 5) ?? ""}–{slot.endTime?.slice(0, 5) ?? ""}
                </span>
              </p>
              {slot.isActive === false ? (
                <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                  無効
                </span>
              ) : (
                <span className="text-xs text-zinc-500">有効</span>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-sm text-zinc-800">
              <div>
                <dt className="text-xs font-medium text-zinc-500">種別</dt>
                <dd className="mt-0.5 wrap-break-word">{typeStr}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">チームA</dt>
                <dd className="mt-0.5 wrap-break-word">{aStr}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">チームB</dt>
                <dd className="mt-0.5 wrap-break-word">{bStr}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">審判</dt>
                <dd className="mt-0.5 wrap-break-word text-zinc-700">{refStr}</dd>
              </div>
              {warnStr !== "—" ? (
                <div>
                  <dt className="text-xs font-medium text-amber-800">警告</dt>
                  <dd className="mt-0.5 wrap-break-word text-xs text-amber-900">{warnStr}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-3 hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain md:block [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-176 border-separate border-spacing-0 text-left text-sm text-zinc-800">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium tracking-wide text-zinc-500">
              <th className="whitespace-nowrap py-2 pr-3">枠</th>
              <th className="whitespace-nowrap py-2 pr-3">枠状態</th>
              <th className="whitespace-nowrap py-2 pr-3">種別</th>
              <th className="min-w-0 py-2 pr-3">チームA</th>
              <th className="min-w-0 py-2 pr-3">チームB</th>
              <th className="min-w-0 py-2 pr-3">審判</th>
              <th className="min-w-0 py-2 pr-1">警告</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {slotRows.map(({ slot, typeStr, aStr, bStr, refStr, warnStr }) => (
              <tr key={slot.slotId} className="align-top">
                <td className="whitespace-nowrap py-2 pr-3 align-top text-zinc-600">
                  {eventSlotLabelJa(slot.slotCode, slot.phase)}
                  <br />
                  <span className="text-xs text-zinc-400">
                    {slot.startTime?.slice(0, 5) ?? ""}–{slot.endTime?.slice(0, 5) ?? ""}
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 align-top text-xs">
                  {slot.isActive === false ? (
                    <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                      無効
                    </span>
                  ) : (
                    <span className="text-zinc-500">有効</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 align-top text-xs text-zinc-700">
                  {typeStr}
                </td>
                <td className="min-w-0 max-w-44 py-2 pr-3 align-top wrap-break-word sm:max-w-56 lg:max-w-72">
                  {aStr}
                </td>
                <td className="min-w-0 max-w-44 py-2 pr-3 align-top wrap-break-word sm:max-w-56 lg:max-w-72">
                  {bStr}
                </td>
                <td className="min-w-0 max-w-36 py-2 pr-3 align-top wrap-break-word text-zinc-700 sm:max-w-48">
                  {refStr}
                </td>
                <td className="min-w-0 max-w-40 py-2 pr-1 align-top wrap-break-word text-xs text-amber-800 sm:max-w-56">
                  {warnStr}
                </td>
              </tr>
            ))}
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
      "自動編成で付けた「午前の補完」と「午後の自動割当」を削除します。",
      "午前で2枠埋まって確定した試合の行は残ります（審判だけクリアされます）。",
      "",
      afternoonListed > 0 || morningFillListed > 0
        ? `（一覧では午前の補完 ${morningFillListed} 件・午後 ${afternoonListed} 件を表示中です）`
        : "（一覧に行がなくても、確定済みの該当データは削除対象です）",
      "",
      "・開催日は「締切済み」に戻ります（自動編成前に近い状態で、一般からの新規予約はまだできません）",
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
          ? ` 午前・確定試合の審判を ${refCleared} 件クリアしました。`
          : "";
      setActionMessage(
        `自動編成を巻き戻しました。午前の補完 ${json.deletedMorningFillCount ?? 0} 件・午後 ${json.deletedAfternoonCount ?? 0} 件を削除し、締切済みに戻しました。${refPart}一般からの予約の再受付にはなっていません。`
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

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">試合編成</h1>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">前日確定 · 対戦表の確認と自動編成</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          対戦表タブでは、
          <strong className="font-medium">
            開催日の初期値は東京の「今日以降で最も近い登録開催日」
          </strong>
          （当日があれば当日）とし、開いたときに一覧を読み込みます。URLで日付を指定して別の開催日を開くこともできます。
          <strong className="font-medium"> 締切済み</strong>
          の日だけ自動編成を実行できます。
          <strong className="font-medium"> 確定</strong>
          済みは巻き戻しで締切済みに戻してから再実行できます（希望枠は予約のまま）。
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
        role="tablist"
        aria-label="試合編成の表示切替"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "matches"}
          onClick={() => setTab("matches")}
          className={`inline-flex min-h-10 w-full min-w-0 items-center justify-center rounded-lg border px-3 text-sm font-medium sm:w-auto ${
            tab === "matches"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
          }`}
        >
          対戦表・自動編成
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "adjust"}
          onClick={() => setTab("adjust")}
          className={`inline-flex min-h-10 w-full min-w-0 items-center justify-center rounded-lg border px-3 text-sm font-medium sm:w-auto ${
            tab === "adjust"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
          }`}
        >
          編成を調整
        </button>
      </div>

      {tab === "adjust" ? <PreDayAdjustPanel eventDate={date} /> : null}

      {tab === "matches" ? (
        <>
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-48 sm:flex-initial">
          <span className="font-medium text-zinc-800">開催日</span>
          <DateInputWithPicker
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 sm:w-auto"
          />
        </label>
        <button
          type="button"
          onClick={() => void loadMatches()}
          disabled={loading}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          {loading ? "読込中…" : "再読込"}
        </button>
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
            この開催日の送信失敗
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-red-900/80">
            宛先と「内容」を確認し、再送できる行は「再送」を押してください。
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
              <h2 className="text-xs font-medium text-zinc-500">状態表示</h2>
              <p className="mt-1 font-medium text-zinc-900">
                {data.eventDay.event_date}{" "}
                <span className="text-zinc-600">（{data.eventDay.grade_band}）</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(data.eventDay.status)}`}
                >
                  {eventDayStatusLabelJa(data.eventDay.status)}
                </span>
                {deadlinePassedAwaitingLock ? (
                  <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950">
                    締切時刻は経過（DB は未ロック）
                  </span>
                ) : null}
              </div>
              {deadlinePassedAwaitingLock ? (
                <div className="mt-2 max-w-2xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold text-amber-950">
                    予約締切の日時は過ぎていますが、開催日の状態はまだ「公開済み」のままです。
                  </p>
                  <p className="mt-1">
                    「締切済み」への自動移行はロック用 Cron（または手動の取りこぼし処理）のタイミングで行われます。それまでは
                    <strong className="font-semibold">自動編成は実行できません</strong>（API も
                    <code className="rounded bg-amber-100/80 px-1">locked</code> のみ許可）。
                  </p>
                  <p className="mt-2">
                    <Link
                      href={`/admin/event-days/${encodeURIComponent(data.eventDay.id)}`}
                      className="font-semibold text-amber-950 underline decoration-amber-800 underline-offset-2 hover:text-amber-900"
                    >
                      この開催日のまとめ（締切取りこぼし）
                    </Link>
                    から、手動で締切処理を進められます。
                  </p>
                </div>
              ) : null}
              {data.eventDay.status === "confirmed" ? (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-600">
                  下の「巻き戻し」で<strong className="font-medium text-zinc-800">締切済み</strong>
                  に戻せます。消えるのは自動で付いた
                  <strong className="font-medium text-zinc-800">午前の補完と午後の自動割当</strong>
                  だけです（
                  <strong className="font-medium text-zinc-800">午前・確定試合</strong>
                  の審判は巻き戻しでクリアされます）。
                  <strong className="font-medium text-zinc-800"> 予約の午前希望枠</strong>
                  は変わりません（一覧は試合行と希望の両方を参照します）。
                </p>
              ) : null}
            </div>
            <dl className="grid w-full min-w-0 shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-xs sm:max-w-sm sm:text-sm">
              <div>
                <dt className="text-zinc-500">午前試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{morningRows.length} 件</dd>
              </div>
              <div>
                <dt className="text-zinc-500">午後試合</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{afternoonRows.length} 件</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">最後の自動編成</dt>
                <dd className="text-zinc-800">
                  {data.matchingRun ? (
                    <>
                      記録あり · 警告 {data.matchingRun.warningCount} 件 · 照会{" "}
                      <span className="font-mono text-xs" title={data.matchingRun.id}>
                        {formatAdminIdTail(data.matchingRun.id)}
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
                <li>自動編成で午後を組み、開催日を確定にします。</li>
              ) : null}
              {status === "confirmed" ? (
                <li>
                  <strong className="font-medium">自動編成の巻き戻し</strong>
                  で午前の補完と午後だけを消し「締切済み」に戻せます。午前・確定試合は残りますが審判はクリアされます。希望枠は予約データのままです。
                </li>
              ) : null}
              {status !== "locked" && status !== "confirmed" ? (
                <li>自動編成・巻き戻しは、締切済みまたは確定のときのみ利用できます。</li>
              ) : null}
            </ul>
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void runMatching()}
              disabled={!canRun || actionBusy !== null}
              title={!canRun ? "締切済み（DB で locked）のときのみ実行できます" : undefined}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:text-zinc-100 disabled:opacity-100 disabled:hover:bg-zinc-400 sm:w-auto"
            >
              {actionBusy === "run" ? "実行中…" : "自動編成を実行"}
            </button>
            <button
              type="button"
              onClick={() => void undoAfternoon()}
              disabled={!canUndo || actionBusy !== null}
              title={
                !canUndo
                  ? "確定のときのみ利用できます"
                  : "午前の補完と午後の自動割当を削除し締切済みに戻します。午前・確定試合は残しますが審判はクリアします。予約（午前希望枠）は変更しません。"
              }
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-700 bg-white px-4 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {actionBusy === "undo"
                ? "処理中…"
                : "巻き戻す（補完・午後を消して締切後へ／希望枠は予約のまま）"}
            </button>
          </div>
          {!canRun && !canUndo ? (
            <p className="mt-2 text-xs text-zinc-600">
              {deadlinePassedAwaitingLock
                ? "上のとおり、締切時刻は過ぎていますが DB がまだ公開中のため、実行ボタンは無効です。"
                : "この状態では自動実行・巻き戻しボタンは無効です（締切済みまたは確定を想定）。"}
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
          <h2 className="text-sm font-medium text-zinc-800">直近の編成の詳細</h2>
          <div className="mt-3 space-y-3 text-zinc-700">
            <div>
              <p className="text-xs font-medium text-zinc-500">午前・未ペア（照会番号・末尾）</p>
              <p className="mt-1 text-xs break-all text-zinc-800">
                {formatAdminIdListTails(lastMeta.unfilledMorningReservationIds)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">午後・未割当（照会番号・末尾）</p>
              <p className="mt-1 text-xs break-all text-zinc-800">
                {formatAdminIdListTails(lastMeta.unfilledAfternoonReservationIds)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">
                1日の試合数が足りない可能性（照会番号・末尾）
              </p>
              <p className="mt-1 text-xs break-all text-zinc-800">
                {lastMeta.targetPlayShortfallReservationIds?.length
                  ? formatAdminIdListTails(lastMeta.targetPlayShortfallReservationIds)
                  : "なし"}
              </p>
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
