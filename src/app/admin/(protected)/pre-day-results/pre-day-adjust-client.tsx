"use client";

import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import {
  assignmentTypeShortLabelJa,
  buildMatchVsLines,
  formatAdminIdTail,
  matchVsTwoLineText,
  teamDisplayNameBare,
  teamGradeCategoryDetailJa,
} from "@/lib/admin/operator-display";
import {
  ADMIN_MATCH_ADJUST_SAVE_BLOCK,
  computeTeamWorkloadSpread,
  validateMergedMatchAssignments,
  type MergedAsgRow,
  type ResShape,
  type SlotShape,
  type TeamWorkloadSpread,
} from "@/lib/admin/validate-merged-match-assignments";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type ActiveReservationJson = {
  id: string;
  teamId: string;
  teamName: string | null;
  strengthCategory: string | null;
  displayName: string | null;
  selectedMorningSlotId: string | null;
};

type SideJson = {
  reservationId: string;
  teamName: string | null;
  displayName: string | null;
  strengthCategory?: string | null;
  representativeGradeYear?: number | null;
};

type AssignmentJson = {
  id: string;
  slotId: string;
  matchPhase: string;
  assignmentType: string;
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

type MorningOccupantJson = {
  reservationId: string;
  teamName: string | null;
  strengthCategory: string | null;
  representativeGradeYear?: number | null;
  displayName: string | null;
};

type SlotOverviewJson = {
  slotId: string;
  slotCode: string;
  phase: string;
  startTime: string;
  endTime: string;
  isActive: boolean | null;
  morningOccupants: MorningOccupantJson[];
  afternoonAssignment: { assignmentId: string } | null;
};

type MatchesPayload = {
  assignments: AssignmentJson[];
  slotsOverview: SlotOverviewJson[];
  activeReservations: ActiveReservationJson[];
  eventDay?: { id?: string; status: string; event_date: string };
  matchingRun?: { id: string } | null;
};

/** 画面上のドラフト（未保存の上書き） */
type DraftPatch = {
  reservationAId: string;
  reservationBId: string;
  refereeReservationId: string | null;
  eventDaySlotId: string;
};

function resLabel(r: ActiveReservationJson): string {
  const name = r.teamName ?? r.displayName ?? formatAdminIdTail(r.id);
  const cat = r.strengthCategory ? ` (${r.strengthCategory})` : "";
  return `${name}${cat}`;
}

/** 一覧の時間表示（午前1 等のコードは出さず時刻のみ） */
function slotTimeRangeLabel(slot: SlotOverviewJson): string {
  const t0 = slot.startTime?.slice(0, 5) ?? "";
  const t1 = slot.endTime?.slice(0, 5) ?? "";
  if (t0 && t1) return `${t0}–${t1}`;
  return t0 || t1 || "—";
}

function slotRowLabel(slot: SlotOverviewJson): string {
  return slotTimeRangeLabel(slot);
}

function formatHmSlotBreak(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** 試合一覧で、直前枠が午前・当枠が午後のとき、その前に昼休憩行を挟む */
function shouldInsertLunchBreakBeforeAdjustSlotRow(
  rows: { slot: SlotOverviewJson }[],
  idx: number
): boolean {
  if (idx <= 0) return false;
  return rows[idx - 1]!.slot.phase === "morning" && rows[idx]!.slot.phase === "afternoon";
}

/** 午前最終枠の終了〜午後先頭枠の開始（欠ける場合は null） */
function lunchBreakTimeLabelAdjustSlotRows(
  rows: { slot: SlotOverviewJson }[],
  idx: number
): string | null {
  if (!shouldInsertLunchBreakBeforeAdjustSlotRow(rows, idx)) return null;
  const prev = rows[idx - 1]!.slot;
  const curr = rows[idx]!.slot;
  const endM = prev.endTime?.trim();
  const startA = curr.startTime?.trim();
  if (!endM || !startA) return null;
  return `${formatHmSlotBreak(endM)}–${formatHmSlotBreak(startA)}`;
}

function activeReservationToSide(
  r: ActiveReservationJson | undefined,
  fallback: SideJson
): SideJson {
  if (!r) return fallback;
  return {
    reservationId: r.id,
    teamName: r.teamName ?? fallback.teamName ?? null,
    displayName: r.displayName ?? fallback.displayName ?? null,
    strengthCategory: (r.strengthCategory ?? fallback.strengthCategory) ?? null,
    /** activeReservations に学年が無いことがあるため割当側を引き継ぐ */
    representativeGradeYear: fallback.representativeGradeYear ?? null,
  };
}

function mergeDraft(asn: AssignmentJson, draft: Record<string, DraftPatch>): DraftPatch {
  const o = draft[asn.id];
  if (o) return o;
  return {
    reservationAId: asn.sideA.reservationId,
    reservationBId: asn.sideB.reservationId,
    refereeReservationId: asn.referee?.reservationId ?? null,
    eventDaySlotId: asn.slotId,
  };
}

function buildEffectiveAssignment(
  asn: AssignmentJson,
  patch: DraftPatch,
  data: MatchesPayload
): AssignmentJson {
  const slotInfo = data.slotsOverview.find((s) => s.slotId === patch.eventDaySlotId);
  const resA = data.activeReservations.find((r) => r.id === patch.reservationAId);
  const resB = data.activeReservations.find((r) => r.id === patch.reservationBId);
  const resRef = patch.refereeReservationId
    ? data.activeReservations.find((r) => r.id === patch.refereeReservationId)
    : null;

  return {
    ...asn,
    slotId: patch.eventDaySlotId,
    slot: slotInfo
      ? {
          slotCode: slotInfo.slotCode,
          phase: slotInfo.phase,
          startTime: slotInfo.startTime,
          endTime: slotInfo.endTime,
        }
      : asn.slot,
    sideA: activeReservationToSide(resA, asn.sideA),
    sideB: activeReservationToSide(resB, asn.sideB),
    referee: resRef ? activeReservationToSide(resRef, asn.referee!) : null,
  };
}

type SlotRowDisplay = {
  selectable: boolean;
  isSelected: boolean;
  typeStr: string;
  matchLine1: string;
  matchLine2: string | null;
  refStr: string;
};

/** 対戦：1行目チーム名 vs、2行目学年・カテゴリ（試合表一覧と同じ） */
function MatchVsDisplayAdjust({
  line1,
  line2,
}: {
  line1: string;
  line2: string | null;
}) {
  const showLine2 = Boolean(line2?.trim()) && line1 !== "—";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="wrap-break-word text-zinc-900">{line1}</span>
      {showLine2 ? (
        <span className="wrap-break-word text-xs leading-snug text-zinc-500">{line2}</span>
      ) : null}
    </div>
  );
}

function getSlotRowDisplay(
  slot: SlotOverviewJson,
  asn: AssignmentJson | null,
  canPatch: boolean,
  selectedAssignmentId: string
): SlotRowDisplay {
  const selectable = asn !== null && canPatch;
  const isSelected = Boolean(asn && selectable && selectedAssignmentId === asn.id);
  const occ = slot.morningOccupants;
  let typeStr = "—";
  let matchLine1 = "—";
  let matchLine2: string | null = null;
  let refStr = "—";
  if (asn) {
    typeStr = assignmentTypeShortLabelJa(asn.assignmentType);
    const built = buildMatchVsLines(
      teamDisplayNameBare(asn.sideA),
      teamDisplayNameBare(asn.sideB),
      teamGradeCategoryDetailJa(asn.sideA),
      teamGradeCategoryDetailJa(asn.sideB)
    );
    matchLine1 = built.matchLine1;
    matchLine2 = built.matchLine2;
    refStr = asn.referee ? teamDisplayNameBare(asn.referee) : "—";
  } else if (slot.phase === "morning" && occ.length > 0) {
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
      matchLine1 = built.matchLine1;
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
  } else if (slot.phase === "afternoon") {
    typeStr = "—";
  }
  return { selectable, isSelected, typeStr, matchLine1, matchLine2, refStr };
}

function buildMergedRows(data: MatchesPayload, draft: Record<string, DraftPatch>): MergedAsgRow[] {
  return data.assignments.map((asn) => {
    const p = mergeDraft(asn, draft);
    return {
      id: asn.id,
      event_day_slot_id: p.eventDaySlotId,
      match_phase: asn.matchPhase,
      reservation_a_id: p.reservationAId,
      reservation_b_id: p.reservationBId,
      referee_reservation_id: p.refereeReservationId,
    };
  });
}

function buildOriginalsById(data: MatchesPayload): Map<string, MergedAsgRow> {
  const m = new Map<string, MergedAsgRow>();
  for (const asn of data.assignments) {
    m.set(asn.id, {
      id: asn.id,
      event_day_slot_id: asn.slotId,
      match_phase: asn.matchPhase,
      reservation_a_id: asn.sideA.reservationId,
      reservation_b_id: asn.sideB.reservationId,
      referee_reservation_id: asn.referee?.reservationId ?? null,
    });
  }
  return m;
}

function buildSlotById(data: MatchesPayload): Map<string, SlotShape> {
  const m = new Map<string, SlotShape>();
  for (const s of data.slotsOverview) {
    m.set(s.slotId, {
      id: s.slotId,
      phase: s.phase,
      start_time: s.startTime,
      end_time: s.endTime,
      is_active: s.isActive,
    });
  }
  return m;
}

function buildResByIdValidate(data: MatchesPayload): Map<string, ResShape> {
  const m = new Map<string, ResShape>();
  for (const r of data.activeReservations) {
    m.set(r.id, { id: r.id, team_id: r.teamId, status: "active" });
  }
  return m;
}

/** 予約ID → 一覧・セレクトと揃えた表示文言 */
function reservationLine(resId: string, data: MatchesPayload): string {
  const r = data.activeReservations.find((x) => x.id === resId);
  return r ? resLabel(r) : formatAdminIdTail(resId);
}

function refereeLine(resId: string | null, data: MatchesPayload): string {
  if (!resId) return "（審判なし）";
  return reservationLine(resId, data);
}

/** 変更前とドラフト（変更後）を並べて表示（同一なら何も出さない） */
function DraftCompareHint({
  beforeText,
  afterText,
}: {
  beforeText: string;
  afterText: string;
}) {
  if (beforeText === afterText) return null;
  return (
    <div
      className="mt-1.5 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-xs leading-snug"
      role="note"
    >
      <p className="text-zinc-600">
        <span className="font-medium text-zinc-800">変更前</span>
        <span className="ml-1.5 wrap-break-word line-through decoration-zinc-400">{beforeText}</span>
      </p>
      <p className="mt-1 text-zinc-900">
        <span className="font-medium text-emerald-800">変更後（まだ反映していません）</span>
        <span className="ml-1.5 wrap-break-word font-medium text-emerald-950">{afterText}</span>
      </p>
    </div>
  );
}

/** 一覧の表セル：変更がある列だけ打消し行＋変更後を縦に並べる（編集フォームの DraftCompareHint と同じ意味） */
function TableCellBeforeAfter({
  beforeText,
  afterText,
}: {
  beforeText: string;
  afterText: string;
}) {
  const multiline = beforeText.includes("\n") || afterText.includes("\n");
  if (beforeText === afterText) {
    return (
      <span className={`wrap-break-word ${multiline ? "whitespace-pre-line" : ""}`}>{afterText}</span>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs leading-snug sm:text-sm">
      <span
        className={`wrap-break-word text-zinc-500 line-through decoration-zinc-400 ${multiline ? "whitespace-pre-line" : ""}`}
      >
        {beforeText}
      </span>
      <span
        className={`wrap-break-word font-medium text-emerald-950 ${multiline ? "whitespace-pre-line" : ""}`}
      >
        {afterText}
      </span>
    </div>
  );
}

function slotCellLabelWithIndex(
  slot: SlotOverviewJson,
  indexZeroBased: number,
  totalInSlot: number
): string {
  const base = slotRowLabel(slot);
  if (totalInSlot <= 1) return base;
  return `${base} （${indexZeroBased + 1}/${totalInSlot}）`;
}

/** モバイルカードの枠見出し（複数試合があるときだけ「試合」を付与） */
function slotCellLabelMobileCard(
  slot: SlotOverviewJson,
  indexZeroBased: number,
  totalInSlot: number
): string {
  const base = slotRowLabel(slot);
  if (totalInSlot <= 1) return base;
  return `${base} （試合 ${indexZeroBased + 1}/${totalInSlot}）`;
}

/** サーバー保存時点で同一枠・同一フェーズに並んでいた試合行（並びは id で固定） */
function assignmentsOnSameSlotServer(
  data: MatchesPayload,
  slotId: string,
  matchPhase: string
): AssignmentJson[] {
  return [...data.assignments]
    .filter((a) => a.slotId === slotId && a.matchPhase === matchPhase)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** 偏り確認モーダル本文（チーム別の min/max は試合表と整合する概要のみ） */
function formatWorkloadConfirmJa(w: TeamWorkloadSpread): string {
  const lines: string[] = [];
  lines.push("チームごとの負荷に偏りがあります。");
  lines.push("");
  if (w.matchSpread >= 2) {
    lines.push(
      `・出場試合数：チーム間で最大 ${w.matchSpread} 試合の差があります（少ないチーム ${w.matchMin} 試合／多いチーム ${w.matchMax} 試合）。`
    );
  }
  if (w.refSpread >= 2) {
    lines.push(
      `・審判担当：チーム間で最大 ${w.refSpread} 回の差があります（少ないチーム ${w.refMin} 回／多いチーム ${w.refMax} 回）。`
    );
  }
  lines.push("");
  lines.push("この内容で保存しますか？");
  return lines.join("\n");
}

/** 試合表の手動調整（対戦チーム・審判の差し替え。試合時刻は一覧のまま変更不可） */
export function PreDayAdjustPanel({ eventDate }: { eventDate: string }) {
  const [data, setData] = useState<MatchesPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [assignmentId, setAssignmentId] = useState<string>("");
  /** サーバー値からの差分のみ保持（キーがある行だけ上書き） */
  const [draftOverrides, setDraftOverrides] = useState<Record<string, DraftPatch>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 出場／審判の偏りが大きいときの確認（保存はユーザー承認後） */
  const [workloadConfirm, setWorkloadConfirm] = useState<TeamWorkloadSpread | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/matches?date=${encodeURIComponent(eventDate)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as MatchesPayload & { error?: string };
      if (!res.ok) {
        setData(null);
        setLoadError(json.error ?? "読み込みに失敗しました。日付と通信を確認してください。");
        return;
      }
      setDraftOverrides({});
      setAssignmentId("");
      setData({
        assignments: json.assignments ?? [],
        slotsOverview: json.slotsOverview ?? [],
        activeReservations: json.activeReservations ?? [],
        eventDay: json.eventDay,
        matchingRun: json.matchingRun ?? null,
      });
    } catch {
      setData(null);
      setLoadError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [eventDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.assignments.find((a) => a.id === assignmentId) ?? null,
    [data, assignmentId]
  );

  const patchForSelected = useMemo(() => {
    if (!data || !selected) return null;
    return mergeDraft(selected, draftOverrides);
  }, [data, selected, draftOverrides]);

  const hasDirtyPatches = useMemo(() => {
    if (!data) return false;
    for (const asn of data.assignments) {
      const p = mergeDraft(asn, draftOverrides);
      if (
        p.reservationAId !== asn.sideA.reservationId ||
        p.reservationBId !== asn.sideB.reservationId ||
        (p.refereeReservationId ?? null) !== (asn.referee?.reservationId ?? null) ||
        p.eventDaySlotId !== asn.slotId
      ) {
        return true;
      }
    }
    return false;
  }, [data, draftOverrides]);

  /** ドラフトがサーバー値と異なる試合行（一覧で変更ありを示す） */
  const dirtyAssignmentIds = useMemo(() => {
    if (!data) return new Set<string>();
    const ids = new Set<string>();
    for (const asn of data.assignments) {
      const p = mergeDraft(asn, draftOverrides);
      if (
        p.reservationAId !== asn.sideA.reservationId ||
        p.reservationBId !== asn.sideB.reservationId ||
        (p.refereeReservationId ?? null) !== (asn.referee?.reservationId ?? null) ||
        p.eventDaySlotId !== asn.slotId
      ) {
        ids.add(asn.id);
      }
    }
    return ids;
  }, [data, draftOverrides]);

  /** フォームで編集中の試合の時刻（枠は変更しないが、一覧と照合できるよう表示） */
  const selectedMatchSlotTimeLabel = useMemo(() => {
    if (!data || !patchForSelected || !selected) return "—";
    const sl = data.slotsOverview.find((s) => s.slotId === patchForSelected.eventDaySlotId);
    if (sl) return slotTimeRangeLabel(sl);
    const st = selected.slot?.startTime;
    const en = selected.slot?.endTime;
    if (st && en) return `${st.slice(0, 5)}–${en.slice(0, 5)}`;
    return "—";
  }, [data, patchForSelected, selected]);

  /** ドラフトの有効な割当で枠ごとに整理（同一枠に複数行が出ることがある） */
  const slotRows = useMemo(() => {
    if (!data) return [];
    const overview = data.slotsOverview.filter((s) => s.isActive !== false);
    return overview.map((slot) => {
      const effectiveForSlot = data.assignments
        .filter((a) => {
          const p = mergeDraft(a, draftOverrides);
          return p.eventDaySlotId === slot.slotId && a.matchPhase === slot.phase;
        })
        .map((a) => buildEffectiveAssignment(a, mergeDraft(a, draftOverrides), data));
      return { slot, assignments: effectiveForSlot };
    });
  }, [data, draftOverrides]);

  const canPatch =
    data?.eventDay?.status === "locked" || data?.eventDay?.status === "confirmed";

  /** 差分があるのに変更理由が空 → ボタン直上で必須を示す */
  const reasonRequiredVisible =
    Boolean(hasDirtyPatches && canPatch && !overrideReason.trim());

  const updateDraft = useCallback(
    (asn: AssignmentJson, partial: Partial<DraftPatch>) => {
      setDraftOverrides((prev) => {
        const cur = mergeDraft(asn, prev);
        return {
          ...prev,
          [asn.id]: {
            reservationAId: partial.reservationAId ?? cur.reservationAId,
            reservationBId: partial.reservationBId ?? cur.reservationBId,
            refereeReservationId:
              partial.refereeReservationId !== undefined
                ? partial.refereeReservationId
                : cur.refereeReservationId,
            eventDaySlotId: partial.eventDaySlotId ?? cur.eventDaySlotId,
          },
        };
      });
    },
    []
  );

  const submit = async (opts?: { skipWorkloadModal?: boolean }) => {
    if (!data) return;
    if (!overrideReason.trim()) {
      setActionMessage(null);
      return;
    }
    if (!canPatch) {
      setActionMessage(
        "試合表を調整できるのは、予約の受付が終わったあとか、開催が確定したあとだけです。"
      );
      return;
    }

    const patches: {
      assignmentId: string;
      reservationAId: string;
      reservationBId: string;
      refereeReservationId: string | null;
      eventDaySlotId: string;
    }[] = [];

    for (const asn of data.assignments) {
      const p = mergeDraft(asn, draftOverrides);
      const unchanged =
        p.reservationAId === asn.sideA.reservationId &&
        p.reservationBId === asn.sideB.reservationId &&
        (p.refereeReservationId ?? null) === (asn.referee?.reservationId ?? null) &&
        p.eventDaySlotId === asn.slotId;
      if (unchanged) continue;
      patches.push({
        assignmentId: asn.id,
        reservationAId: p.reservationAId,
        reservationBId: p.reservationBId,
        refereeReservationId: p.refereeReservationId,
        eventDaySlotId: p.eventDaySlotId,
      });
    }

    if (patches.length === 0) {
      setActionMessage("変更がありません");
      return;
    }

    const merged = buildMergedRows(data, draftOverrides);
    const originalsById = buildOriginalsById(data);
    const slotById = buildSlotById(data);
    const resById = buildResByIdValidate(data);

    const v = validateMergedMatchAssignments(merged, originalsById, slotById, resById);
    if (!v.ok) {
      setActionMessage(v.message);
      return;
    }

    const workload = computeTeamWorkloadSpread(merged, resById);
    if (workload.needsWorkloadConfirm && !opts?.skipWorkloadModal) {
      setWorkloadConfirm(workload);
      setActionMessage(null);
      return;
    }

    setWorkloadConfirm(null);

    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/matches/batch-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventDate,
          overrideReason: overrideReason.trim(),
          patches,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        const err = json.error ?? "";
        const display =
          err.includes("同一時刻帯") || err.includes("複数の試合")
            ? ADMIN_MATCH_ADJUST_SAVE_BLOCK
            : err || "保存に失敗しました。画面を再読み込みしてから再度お試しください。";
        setActionMessage(display);
        return;
      }
      setActionMessage(
        "変更を保存しました。「自動作成」タブで内容を確認できます。"
      );
      setOverrideReason("");
      await load();
    } catch {
      setActionMessage("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">手動調整</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 wrap-break-word">
          <span className="font-medium text-zinc-800">{eventDate}</span>
          の試合表を調整します。一覧から試合を選び、対戦や審判を変更してください。変更は保存するまで反映されません。
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:order-first sm:min-h-10 sm:w-auto sm:justify-start"
          >
            {loading ? "読込中…" : "表示を更新"}
          </button>
          {data?.eventDay?.id ? (
            <Link
              href={`/admin/event-days/${encodeURIComponent(data.eventDay.id)}`}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50/90 px-3 text-sm font-normal text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-800 sm:min-h-10 sm:w-auto"
            >
              この日の運営画面に進む
            </Link>
          ) : null}
        </div>
        {data?.eventDay ? (
          <span className="min-w-0 text-xs leading-relaxed text-zinc-600 sm:inline-flex sm:items-center">
            開催状況：
            <span className="ml-1 font-medium text-zinc-800">
              {eventDayStatusLabelJa(data.eventDay.status)}
            </span>
            {!canPatch ? (
              <span className="mt-2 block text-sm text-amber-900 sm:mt-0 sm:ml-2 sm:inline">
                {data.eventDay.status === "open"
                  ? "現在は予約受付中のため、試合表は編集できません。予約締切後に編集できます。"
                  : "この状態では試合表を編集できません。"}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}

      {!data?.matchingRun ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
          試合表の自動作成がまだないため、調整できる試合がありません。「自動作成」タブで「試合表を自動作成する」を先に実行してください。
        </p>
      ) : data.assignments.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
          試合割当が0件です。
        </p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
            <div className="pb-1">
              <h3 className="text-base font-bold text-zinc-900">試合一覧</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                変更したいチーム名・審判をタップして変更します。変更は保存するまで反映されません。
              </p>
            </div>

            <div className="mt-4 space-y-4 md:hidden">
              {slotRows.flatMap(({ slot, assignments: asns }, slotIdx) => {
                const lunchLabel = lunchBreakTimeLabelAdjustSlotRows(slotRows, slotIdx);
                const nodes: ReactNode[] = [];
                if (shouldInsertLunchBreakBeforeAdjustSlotRow(slotRows, slotIdx)) {
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
                if (asns.length === 0) {
                  nodes.push(
                  <div
                    key={slot.slotId}
                    className="rounded-xl border border-dashed border-zinc-200/90 bg-white/55 p-3 text-sm text-zinc-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)] backdrop-blur-[2px]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-medium tabular-nums text-zinc-800 wrap-break-word">
                        {slotRowLabel(slot)}
                      </p>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          閲覧のみ
                        </span>
                        {slot.isActive === false ? (
                          <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                            未使用
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {(() => {
                      const row = getSlotRowDisplay(slot, null, canPatch, assignmentId);
                      return (
                        <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-xs sm:grid-cols-[5rem_1fr]">
                          <dt className="text-zinc-500">種別</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">{row.typeStr}</dd>
                          <dt className="text-zinc-500">対戦</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">
                            <MatchVsDisplayAdjust line1={row.matchLine1} line2={row.matchLine2} />
                          </dd>
                          <dt className="text-zinc-500">審判</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">{row.refStr}</dd>
                        </dl>
                      );
                    })()}
                  </div>
                  );
                } else {
                  nodes.push(
                  ...asns.map((effAsn) => {
                    const idx = asns.indexOf(effAsn);
                    const row = getSlotRowDisplay(slot, effAsn, canPatch, assignmentId);
                    const rowDraftDirty = dirtyAssignmentIds.has(effAsn.id);
                    const origAsn = data!.assignments.find((a) => a.id === effAsn.id);
                    const origSlot = origAsn
                      ? data!.slotsOverview.find((s) => s.slotId === origAsn.slotId)
                      : undefined;
                    const serverSiblings = origAsn
                      ? assignmentsOnSameSlotServer(data!, origAsn.slotId, origAsn.matchPhase)
                      : [];
                    const origIdxRaw = origAsn
                      ? serverSiblings.findIndex((a) => a.id === effAsn.id)
                      : -1;
                    const origIdx = origIdxRaw >= 0 ? origIdxRaw : 0;
                    const origTotal = serverSiblings.length;
                    const rowBefore =
                      rowDraftDirty && origAsn && origSlot
                        ? getSlotRowDisplay(origSlot, origAsn, canPatch, assignmentId)
                        : null;
                    const slotBeforeLabelMobile =
                      origSlot != null
                        ? slotCellLabelMobileCard(origSlot, origIdx, origTotal)
                        : slotCellLabelMobileCard(slot, idx, asns.length);
                    const slotAfterLabelMobile = slotCellLabelMobileCard(slot, idx, asns.length);

                    return (
                      <div
                        key={effAsn.id}
                        onClick={() => {
                          if (effAsn && canPatch) setAssignmentId(effAsn.id);
                        }}
                        onKeyDown={(e) => {
                          if (!effAsn || !canPatch) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAssignmentId(effAsn.id);
                          }
                        }}
                        tabIndex={row.selectable ? 0 : -1}
                        role={row.selectable ? "button" : undefined}
                        aria-selected={row.isSelected}
                        className={`rounded-xl border p-3 text-sm shadow-sm transition-[box-shadow,background-color,border-color] ${
                          rowDraftDirty ? "border-l-4 border-l-amber-500 bg-amber-50/60 " : ""
                        }${
                          row.selectable
                            ? `cursor-pointer backdrop-blur-[2px] active:bg-emerald-50/50 ${
                                row.isSelected
                                  ? "border-emerald-400/90 bg-emerald-50/85 shadow-[inset_0_0_0_1px_rgba(167,243,208,0.55),0_4px_14px_-4px_rgba(16,185,129,0.18)] ring-2 ring-emerald-400/30"
                                  : "border-emerald-200/50 bg-emerald-50/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)] hover:border-emerald-300/70 hover:bg-emerald-50/45 hover:shadow-md"
                              }`
                            : "cursor-default border-dashed border-zinc-200/90 bg-white/55 backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 font-medium tabular-nums text-zinc-900 wrap-break-word">
                            {rowDraftDirty && origSlot ? (
                              <TableCellBeforeAfter
                                beforeText={slotBeforeLabelMobile}
                                afterText={slotAfterLabelMobile}
                              />
                            ) : (
                              <>
                                {slotRowLabel(slot)}
                                {asns.length > 1 ? (
                                  <span className="ml-1 text-xs font-normal text-zinc-500">
                                    （試合 {idx + 1}/{asns.length}）
                                  </span>
                                ) : null}
                              </>
                            )}
                          </p>
                          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            {!row.selectable || !canPatch ? (
                              <span className="rounded-md border border-zinc-200/90 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-zinc-500 backdrop-blur-sm">
                                閲覧のみ
                              </span>
                            ) : null}
                            {rowDraftDirty && origSlot && origSlot.isActive !== slot.isActive ? (
                              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-950">
                                {slot.isActive === false ? "→未使用" : "→利用"}
                              </span>
                            ) : slot.isActive === false ? (
                              <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                                未使用
                              </span>
                            ) : null}
                            {rowDraftDirty ? (
                              <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                                変更あり
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-xs sm:grid-cols-[5rem_1fr]">
                          <dt className="text-zinc-500">種別</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">
                            {rowBefore ? (
                              <TableCellBeforeAfter
                                beforeText={rowBefore.typeStr}
                                afterText={row.typeStr}
                              />
                            ) : (
                              row.typeStr
                            )}
                          </dd>
                          <dt className="text-zinc-500">対戦</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">
                            {row.isSelected && canPatch && selected && patchForSelected ? (
                              <div className="grid grid-cols-1 gap-2" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={patchForSelected.reservationAId}
                                  onChange={(e) =>
                                    updateDraft(selected, { reservationAId: e.target.value })
                                  }
                                  className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation"
                                >
                                  {data!.activeReservations
                                    .filter((r) => r.id !== patchForSelected.reservationBId)
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {resLabel(r)}
                                      </option>
                                    ))}
                                </select>
                                <select
                                  value={patchForSelected.reservationBId}
                                  onChange={(e) =>
                                    updateDraft(selected, { reservationBId: e.target.value })
                                  }
                                  className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation"
                                >
                                  {data!.activeReservations
                                    .filter((r) => r.id !== patchForSelected.reservationAId)
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {resLabel(r)}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : rowBefore ? (
                              <TableCellBeforeAfter
                                beforeText={matchVsTwoLineText(rowBefore.matchLine1, rowBefore.matchLine2)}
                                afterText={matchVsTwoLineText(row.matchLine1, row.matchLine2)}
                              />
                            ) : (
                              <div className="space-y-0.5">
                                <button
                                  type="button"
                                  className="block text-left font-medium text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (canPatch) setAssignmentId(effAsn.id);
                                  }}
                                >
                                  {row.matchLine1}
                                </button>
                                <button
                                  type="button"
                                  className="block text-left text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (canPatch) setAssignmentId(effAsn.id);
                                  }}
                                >
                                  {row.matchLine2}
                                </button>
                              </div>
                            )}
                          </dd>
                          <dt className="text-zinc-500">審判</dt>
                          <dd className="min-w-0 wrap-break-word text-zinc-800">
                            {row.isSelected && canPatch && selected && patchForSelected ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={patchForSelected.refereeReservationId ?? ""}
                                  onChange={(e) =>
                                    updateDraft(selected, {
                                      refereeReservationId: e.target.value ? e.target.value : null,
                                    })
                                  }
                                  className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation"
                                >
                                  <option value="">（審判なし）</option>
                                  {data!.activeReservations
                                    .filter(
                                      (r) =>
                                        r.id !== patchForSelected.reservationAId &&
                                        r.id !== patchForSelected.reservationBId
                                    )
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {resLabel(r)}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : rowBefore ? (
                              <TableCellBeforeAfter beforeText={rowBefore.refStr} afterText={row.refStr} />
                            ) : (
                              <button
                                type="button"
                                className="text-left font-medium text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (canPatch) setAssignmentId(effAsn.id);
                                }}
                              >
                                {row.refStr}
                              </button>
                            )}
                          </dd>
                        </dl>
                      </div>
                    );
                  })
                );
                }
                return nodes;
              })}
            </div>

            <div className="mt-4 hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200/90 bg-zinc-50/40 shadow-inner [-webkit-overflow-scrolling:touch] md:block">
              <table className="w-full min-w-xl table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-left text-sm text-zinc-800 sm:min-w-2xl">
                <colgroup>
                  <col style={{ width: "5rem" }} />
                  <col style={{ width: "3.5rem" }} />
                  <col style={{ width: "52%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr className="text-xs font-semibold tracking-wide text-zinc-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/80">
                    <th className="rounded-tl-lg bg-zinc-100/95 py-2.5 pl-3 pr-2 align-bottom">時間</th>
                    <th className="bg-zinc-100/95 py-2.5 pr-2 align-bottom">種別</th>
                    <th className="min-w-0 bg-zinc-100/95 py-2.5 pr-3 align-bottom">対戦</th>
                    <th className="min-w-0 rounded-tr-lg bg-zinc-100/95 py-2.5 pr-3 align-bottom">審判</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent">
                  {slotRows.flatMap(({ slot, assignments: asns }, slotIdx) => {
                    const lunchLabel = lunchBreakTimeLabelAdjustSlotRows(slotRows, slotIdx);
                    const blockRows: ReactNode[] = [];
                    if (shouldInsertLunchBreakBeforeAdjustSlotRow(slotRows, slotIdx)) {
                      blockRows.push(
                        <tr
                          key={`lunch-${slot.slotId}`}
                          className="rounded-lg bg-zinc-100/45 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-zinc-200/65"
                        >
                          <td colSpan={4} className="rounded-lg py-1.5 px-3 text-center">
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
                    if (asns.length === 0) {
                      const row = getSlotRowDisplay(slot, null, canPatch, assignmentId);
                      blockRows.push(
                              <tr
                                key={`${slot.slotId}-empty`}
                                className="cursor-default align-top rounded-lg bg-zinc-50/90 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/75"
                              >
                                <td className="rounded-l-lg py-3 pl-3 pr-2 align-top text-xs leading-tight text-zinc-600">
                                  <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                    <span className="inline-flex min-w-0 whitespace-nowrap tabular-nums text-xs font-medium text-zinc-700">
                                      {slotTimeRangeLabel(slot)}
                                    </span>
                                    {slot.isActive === false ? (
                                      <span className="shrink-0 rounded border border-zinc-300 bg-zinc-100 px-1 py-px text-[10px] text-zinc-600">
                                        未使用
                                      </span>
                                    ) : null}
                                  </span>
                                </td>
                                <td className="py-3 pr-2 align-top text-xs text-zinc-700">{row.typeStr}</td>
                                <td className="min-w-0 py-3 pr-3 align-top">
                                  <div className="min-w-0">
                                    <MatchVsDisplayAdjust line1={row.matchLine1} line2={row.matchLine2} />
                                  </div>
                                </td>
                                <td className="min-w-0 rounded-r-lg py-3 pr-3 wrap-break-word text-zinc-700">
                                  {row.refStr}
                                </td>
                              </tr>
                      );
                    } else {
                      blockRows.push(
                        ...asns.map((effAsn, idx) => {
                          const row = getSlotRowDisplay(slot, effAsn, canPatch, assignmentId);
                          const rowDraftDirty = dirtyAssignmentIds.has(effAsn.id);
                          const origAsn = data!.assignments.find((a) => a.id === effAsn.id);
                          const origSlot = origAsn
                            ? data!.slotsOverview.find((s) => s.slotId === origAsn.slotId)
                            : undefined;
                          const serverSiblings = origAsn
                            ? assignmentsOnSameSlotServer(data!, origAsn.slotId, origAsn.matchPhase)
                            : [];
                          const origIdxRaw = origAsn
                            ? serverSiblings.findIndex((a) => a.id === effAsn.id)
                            : -1;
                          const origIdx = origIdxRaw >= 0 ? origIdxRaw : 0;
                          const origTotal = serverSiblings.length;
                          const rowBefore =
                            rowDraftDirty && origAsn && origSlot
                              ? getSlotRowDisplay(origSlot, origAsn, canPatch, assignmentId)
                              : null;
                          const slotBeforeLabelDesktop =
                            origSlot != null
                              ? slotCellLabelWithIndex(origSlot, origIdx, origTotal)
                              : slotCellLabelWithIndex(slot, idx, asns.length);
                          const slotAfterLabelDesktop = slotCellLabelWithIndex(slot, idx, asns.length);

                          return (
                            <tr
                              key={effAsn.id}
                              onClick={() => {
                                if (effAsn && canPatch) setAssignmentId(effAsn.id);
                              }}
                              onKeyDown={(e) => {
                                if (!effAsn || !canPatch) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setAssignmentId(effAsn.id);
                                }
                              }}
                              tabIndex={row.selectable ? 0 : -1}
                              role={row.selectable ? "button" : undefined}
                              aria-selected={row.isSelected}
                              className={
                                rowDraftDirty
                                  ? `align-top rounded-lg border-l-4 border-l-amber-500 bg-amber-50/55 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-amber-200/75 transition-[background-color,box-shadow] ${
                                      row.selectable ? "cursor-pointer" : "cursor-default"
                                    }`
                                  : row.selectable
                                    ? `align-top cursor-pointer rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 transition-[background-color,box-shadow] hover:bg-emerald-50/40 ${
                                        row.isSelected
                                          ? "bg-emerald-50/95 ring-emerald-300/65"
                                          : "bg-white ring-zinc-200/75"
                                      }`
                                    : "align-top cursor-default rounded-lg bg-zinc-50/85 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-zinc-200/75 transition-[background-color,box-shadow]"
                              }
                            >
                              <td className="rounded-l-lg py-3 pl-3 pr-2 align-top text-xs leading-tight text-zinc-600">
                                <div className="flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-1">
                                  {rowDraftDirty && origSlot ? (
                                    <TableCellBeforeAfter
                                      beforeText={slotBeforeLabelDesktop}
                                      afterText={slotAfterLabelDesktop}
                                    />
                                  ) : (
                                    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1 font-medium tabular-nums text-zinc-700">
                                      <span>{slotTimeRangeLabel(slot)}</span>
                                      {asns.length > 1 ? (
                                        <span className="text-xs font-normal text-zinc-500">
                                          （{idx + 1}/{asns.length}）
                                        </span>
                                      ) : null}
                                    </span>
                                  )}
                                  {rowDraftDirty && origSlot && origSlot.isActive !== slot.isActive ? (
                                    <span className="inline-block shrink-0 rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-950">
                                      {slot.isActive === false ? "→未使用" : "→利用"}
                                    </span>
                                  ) : slot.isActive === false ? (
                                    <span className="inline-block shrink-0 rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-600">
                                      未使用
                                    </span>
                                  ) : null}
                                  {rowDraftDirty ? (
                                    <span className="inline-block shrink-0 rounded border border-amber-300 bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-950">
                                      変更あり
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-3 pr-2 align-top text-xs text-zinc-700">
                                {rowBefore ? (
                                  <TableCellBeforeAfter
                                    beforeText={rowBefore.typeStr}
                                    afterText={row.typeStr}
                                  />
                                ) : (
                                  row.typeStr
                                )}
                              </td>
                              <td className="min-w-0 py-3 pr-3 align-top">
                                <div className="min-w-0">
                                  {row.isSelected && canPatch && selected && patchForSelected ? (
                                    <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={patchForSelected.reservationAId}
                                        onChange={(e) =>
                                          updateDraft(selected, { reservationAId: e.target.value })
                                        }
                                        className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
                                      >
                                        {data!.activeReservations
                                          .filter((r) => r.id !== patchForSelected.reservationBId)
                                          .map((r) => (
                                            <option key={r.id} value={r.id}>
                                              {resLabel(r)}
                                            </option>
                                          ))}
                                      </select>
                                      <select
                                        value={patchForSelected.reservationBId}
                                        onChange={(e) =>
                                          updateDraft(selected, { reservationBId: e.target.value })
                                        }
                                        className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
                                      >
                                        {data!.activeReservations
                                          .filter((r) => r.id !== patchForSelected.reservationAId)
                                          .map((r) => (
                                            <option key={r.id} value={r.id}>
                                              {resLabel(r)}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                  ) : rowBefore ? (
                                    <TableCellBeforeAfter
                                      beforeText={matchVsTwoLineText(rowBefore.matchLine1, rowBefore.matchLine2)}
                                      afterText={matchVsTwoLineText(row.matchLine1, row.matchLine2)}
                                    />
                                  ) : (
                                    <div className="space-y-0.5">
                                      <button
                                        type="button"
                                        className="block text-left font-medium text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (canPatch) setAssignmentId(effAsn.id);
                                        }}
                                      >
                                        {row.matchLine1}
                                      </button>
                                      <button
                                        type="button"
                                        className="block text-left text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (canPatch) setAssignmentId(effAsn.id);
                                        }}
                                      >
                                        {row.matchLine2}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="min-w-0 rounded-r-lg py-3 pr-3 wrap-break-word text-zinc-700">
                                {row.isSelected && canPatch && selected && patchForSelected ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={patchForSelected.refereeReservationId ?? ""}
                                      onChange={(e) =>
                                        updateDraft(selected, {
                                          refereeReservationId: e.target.value ? e.target.value : null,
                                        })
                                      }
                                      className="min-h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
                                    >
                                      <option value="">（審判なし）</option>
                                      {data!.activeReservations
                                        .filter(
                                          (r) =>
                                            r.id !== patchForSelected.reservationAId &&
                                            r.id !== patchForSelected.reservationBId
                                        )
                                        .map((r) => (
                                          <option key={r.id} value={r.id}>
                                            {resLabel(r)}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                ) : rowBefore ? (
                                  <TableCellBeforeAfter beforeText={rowBefore.refStr} afterText={row.refStr} />
                                ) : (
                                  <button
                                    type="button"
                                    className="text-left font-medium text-emerald-900 underline decoration-emerald-700/30 underline-offset-2"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (canPatch) setAssignmentId(effAsn.id);
                                    }}
                                  >
                                    {row.refStr}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      );
                    }
                    return blockRows;
                  })}
                </tbody>
              </table>
            </div>
            {!canPatch ? (
              <p className="mt-2 text-xs text-amber-800 wrap-break-word">
                {data?.eventDay?.status === "open"
                  ? "現在は予約受付中のため、試合表は編集できません。予約締切後に編集できます。"
                  : "この状態では試合表を編集できません。"}
              </p>
            ) : (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500 wrap-break-word">
                未保存の変更がある行は「変更あり」と表示されます。
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
            {hasDirtyPatches ? (
              <p className="text-xs text-zinc-600">保存していない変更があります。</p>
            ) : null}

            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">今回保存する変更の理由（必須）</span>
              <p className="text-xs leading-relaxed text-zinc-600">
                保存するすべての変更に対する理由として記録されます。
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                aria-invalid={reasonRequiredVisible}
                aria-describedby={
                  reasonRequiredVisible ? "adjust-override-reason-hint" : undefined
                }
                className={`min-h-[88px] w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base text-zinc-900 touch-manipulation md:text-sm ${
                  reasonRequiredVisible
                    ? "border-red-300 ring-1 ring-red-200/60"
                    : "border-zinc-300"
                }`}
                placeholder="例：チームの希望、対戦の調整、審判の入れ替え"
              />
            </label>

            {actionMessage ? (
              <p
                className={`rounded-md border px-3 py-2 text-sm wrap-break-word ${
                  actionMessage.includes("変更を保存しました")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
                role="status"
              >
                {actionMessage}
              </p>
            ) : null}

            {reasonRequiredVisible ? (
              <p
                id="adjust-override-reason-hint"
                className="text-sm leading-snug text-red-600/90"
                role="alert"
              >
                今回保存する変更の理由を入力してください（保存には必須です）。
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !canPatch || !hasDirtyPatches}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:min-h-11 sm:w-auto sm:text-sm"
            >
              {saving ? "保存中…" : "変更を保存"}
            </button>
          </div>
        </div>
      )}

      {workloadConfirm ? (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/45 p-4 pb-8 backdrop-blur-[1px] sm:items-center sm:pb-4"
          role="presentation"
          onClick={() => setWorkloadConfirm(null)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workload-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="workload-confirm-title"
              className="text-base font-semibold text-zinc-900"
            >
              負荷の偏りの確認
            </h3>
            <pre className="mt-3 whitespace-pre-wrap wrap-break-word font-sans text-sm text-zinc-800">
              {formatWorkloadConfirmJa(workloadConfirm)}
            </pre>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWorkloadConfirm(null)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-900 hover:bg-zinc-50 touch-manipulation sm:min-h-11 sm:w-auto sm:text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void submit({ skipWorkloadModal: true })}
                disabled={saving}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:min-h-11 sm:w-auto sm:text-sm"
              >
                {saving ? "保存中…" : "この内容で保存する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
