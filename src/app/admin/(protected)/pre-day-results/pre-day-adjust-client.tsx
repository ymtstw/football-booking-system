"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  eventDay?: { status: string; event_date: string };
  matchingRun?: { id: string } | null;
};

function resLabel(r: ActiveReservationJson): string {
  const name = r.teamName ?? r.displayName ?? r.id.slice(0, 8);
  const cat = r.strengthCategory ? ` (${r.strengthCategory})` : "";
  return `${name}${cat}`;
}

function sideShort(s: SideJson): string {
  return s.teamName ?? s.displayName ?? s.reservationId.slice(0, 8) + "…";
}

function slotRowLabel(slot: SlotOverviewJson): string {
  const ph = slot.phase === "morning" ? "午前" : "午後";
  const t0 = slot.startTime?.slice(0, 5) ?? "";
  const t1 = slot.endTime?.slice(0, 5) ?? "";
  return `${ph} ${slot.slotCode}（${t0}–${t1}）`;
}

type SlotRowDisplay = {
  selectable: boolean;
  isSelected: boolean;
  typeStr: string;
  aStr: string;
  bStr: string;
  refStr: string;
};

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
  let aStr = "—";
  let bStr = "—";
  let refStr = "—";
  if (asn) {
    typeStr = asn.assignmentType;
    aStr = sideShort(asn.sideA);
    bStr = sideShort(asn.sideB);
    refStr = asn.referee ? sideShort(asn.referee) : "—";
  } else if (slot.phase === "morning" && occ.length > 0) {
    typeStr = "予約のみ";
    aStr = occ[0]
      ? occ[0].teamName ?? occ[0].displayName ?? occ[0].reservationId.slice(0, 8) + "…"
      : "—";
    const second = occ[1];
    bStr =
      occ.length > 1 && second
        ? second.teamName ?? second.displayName ?? second.reservationId.slice(0, 8) + "…"
        : "—";
  } else if (slot.phase === "afternoon") {
    typeStr = "未編成";
  }
  return { selectable, isSelected, typeStr, aStr, bStr, refStr };
}

/** SCR-12 確定補正（試合行の予約差し替え・午後枠移動・審判） */
export function PreDayAdjustPanel({ eventDate }: { eventDate: string }) {
  const [data, setData] = useState<MatchesPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [assignmentId, setAssignmentId] = useState<string>("");
  const [reservationAId, setReservationAId] = useState("");
  const [reservationBId, setReservationBId] = useState("");
  const [refereeReservationId, setRefereeReservationId] = useState<string>(""); // "" = 審判なし
  const [eventDaySlotId, setEventDaySlotId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        setLoadError(json.error ?? `読み込み失敗 (${res.status})`);
        return;
      }
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

  useEffect(() => {
    if (!selected) {
      setReservationAId("");
      setReservationBId("");
      setRefereeReservationId("");
      setEventDaySlotId("");
      return;
    }
    setReservationAId(selected.sideA.reservationId);
    setReservationBId(selected.sideB.reservationId);
    setRefereeReservationId(selected.referee?.reservationId ?? "");
    setEventDaySlotId(selected.slotId);
  }, [selected]);

  const afternoonSlotChoices = useMemo(() => {
    if (!data || !selected || selected.matchPhase !== "afternoon") return [];
    return data.slotsOverview.filter((s) => {
      if (s.phase !== "afternoon") return false;
      if (s.isActive === false) return false;
      const occ = s.afternoonAssignment;
      if (!occ) return true;
      return occ.assignmentId === selected.id;
    });
  }, [data, selected]);

  /** 各枠に対応する試合行（無い枠は null＝午前の予約のみ・午後未編成など） */
  const slotRows = useMemo(() => {
    if (!data) return [];
    return data.slotsOverview.map((slot) => {
      const asn =
        data.assignments.find(
          (a) => a.slotId === slot.slotId && a.matchPhase === slot.phase
        ) ?? null;
      return { slot, assignment: asn };
    });
  }, [data]);

  const canPatch =
    data?.eventDay?.status === "locked" ||
    data?.eventDay?.status === "confirmed";

  const submit = async () => {
    if (!assignmentId || !selected) {
      setActionMessage("試合行を選択してください");
      return;
    }
    if (!overrideReason.trim()) {
      setActionMessage("補正理由を入力してください");
      return;
    }
    if (!canPatch) {
      setActionMessage("locked / confirmed の開催日のみ補正できます");
      return;
    }
    setSaving(true);
    setActionMessage(null);
    try {
      const body: Record<string, unknown> = {
        overrideReason: overrideReason.trim(),
        reservationAId,
        reservationBId,
        eventDaySlotId,
      };
      if (refereeReservationId) {
        body.refereeReservationId = refereeReservationId;
      } else {
        body.refereeReservationId = null;
      }
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(assignmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setActionMessage(json.error ?? `保存に失敗しました (${res.status})`);
        return;
      }
      setActionMessage("補正を保存しました。試合一覧タブで内容を確認できます。");
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
        <p className="text-xs font-medium text-zinc-500">SCR-12 / 確定補正</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">確定の補正</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 wrap-break-word">
          開催日は試合一覧タブと同じ日付（
          <span className="font-mono text-xs">{eventDate}</span>
          ）です。下の<strong className="font-medium">枠一覧</strong>
          から補正する試合行を選び、続けて予約・枠を変更して保存します。枠移動は
          <strong className="font-medium">午後試合のみ</strong>です。
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:min-h-10 sm:w-auto sm:justify-start"
        >
          {loading ? "読込中…" : "再読込"}
        </button>
        {data?.eventDay ? (
          <span className="min-w-0 text-xs leading-relaxed text-zinc-600 sm:inline-flex sm:items-center">
            開催日ステータス:{" "}
            <span className="ml-1 font-mono">{data.eventDay.status}</span>
            {!canPatch ? (
              <span className="mt-1 block text-amber-800 sm:mt-0 sm:ml-2 sm:inline">
                （補正は locked / confirmed のみ）
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
          current の matching_run が無いため、補正対象の試合行がありません（先に自動編成を実行してください）。
        </p>
      ) : data.assignments.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
          試合割当が0件です。
        </p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
            <h3 className="text-sm font-medium text-zinc-900">枠・試合一覧（行を選択）</h3>
            <p className="mt-1 text-xs text-zinc-500 md:hidden">
              スマホではカード表示です。PC幅では表に切り替わります。
            </p>
            <p className="mt-1 hidden text-xs text-zinc-500 md:block">
              行をクリックして試合行を選択します。
            </p>

            {/* 狭い画面: カード一覧（タップ領域を広げる） */}
            <div className="mt-3 space-y-2 md:hidden">
              {slotRows.map(({ slot, assignment: asn }) => {
                const row = getSlotRowDisplay(slot, asn, canPatch, assignmentId);
                const activeBadge =
                  slot.isActive === false ? (
                    <span className="shrink-0 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                      無効枠
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-500">有効</span>
                  );
                return (
                  <div
                    key={slot.slotId}
                    onClick={() => {
                      if (asn && canPatch) setAssignmentId(asn.id);
                    }}
                    onKeyDown={(e) => {
                      if (!asn || !canPatch) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAssignmentId(asn.id);
                      }
                    }}
                    tabIndex={row.selectable ? 0 : -1}
                    role={row.selectable ? "button" : undefined}
                    aria-selected={row.isSelected}
                    className={`rounded-lg border p-3 text-sm transition-colors ${
                      row.selectable
                        ? `cursor-pointer active:bg-zinc-100 ${
                            row.isSelected
                              ? "border-emerald-300 bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                              : "border-zinc-200 bg-white hover:bg-zinc-50"
                          }`
                        : "cursor-default border-zinc-100 bg-zinc-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-medium text-zinc-900 wrap-break-word">
                        {slotRowLabel(slot)}
                      </p>
                      {activeBadge}
                    </div>
                    <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-xs sm:grid-cols-[5rem_1fr]">
                      <dt className="text-zinc-500">種別</dt>
                      <dd className="min-w-0 wrap-break-word font-mono text-zinc-800">{row.typeStr}</dd>
                      <dt className="text-zinc-500">チームA</dt>
                      <dd className="min-w-0 wrap-break-word text-zinc-800">{row.aStr}</dd>
                      <dt className="text-zinc-500">チームB</dt>
                      <dd className="min-w-0 wrap-break-word text-zinc-800">{row.bStr}</dd>
                      <dt className="text-zinc-500">審判</dt>
                      <dd className="min-w-0 wrap-break-word text-zinc-800">{row.refStr}</dd>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* 768px以上: 表（横スクロール） */}
            <div className="mt-3 hidden min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] md:block">
              <table className="w-full min-w-176 border-separate border-spacing-0 text-left text-sm text-zinc-800">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                    <th className="max-w-xs min-w-48 py-2 pr-3">枠</th>
                    <th className="whitespace-nowrap py-2 pr-3">枠状態</th>
                    <th className="whitespace-nowrap py-2 pr-3">種別</th>
                    <th className="min-w-0 py-2 pr-3">チームA</th>
                    <th className="min-w-0 py-2 pr-3">チームB</th>
                    <th className="min-w-0 py-2 pr-2">審判</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {slotRows.map(({ slot, assignment: asn }) => {
                    const row = getSlotRowDisplay(slot, asn, canPatch, assignmentId);
                    return (
                      <tr
                        key={slot.slotId}
                        onClick={() => {
                          if (asn && canPatch) setAssignmentId(asn.id);
                        }}
                        onKeyDown={(e) => {
                          if (!asn || !canPatch) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAssignmentId(asn.id);
                          }
                        }}
                        tabIndex={row.selectable ? 0 : -1}
                        role={row.selectable ? "button" : undefined}
                        aria-selected={row.isSelected}
                        className={`align-top transition-colors ${
                          row.selectable
                            ? `cursor-pointer hover:bg-zinc-50 ${
                                row.isSelected ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300" : ""
                              }`
                            : "cursor-default bg-zinc-50/40"
                        }`}
                      >
                        <td className="max-w-xs min-w-48 py-2 pr-3 text-zinc-700 wrap-break-word whitespace-normal">
                          {slotRowLabel(slot)}
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
                        <td className="max-w-40 py-2 pr-3 font-mono text-xs wrap-break-word whitespace-normal text-zinc-700">
                          {row.typeStr}
                        </td>
                        <td className="min-w-0 py-2 pr-3 wrap-break-word">{row.aStr}</td>
                        <td className="min-w-0 py-2 pr-3 wrap-break-word">{row.bStr}</td>
                        <td className="min-w-0 py-2 pr-2 wrap-break-word text-zinc-700">{row.refStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!canPatch ? (
              <p className="mt-2 text-xs text-amber-800 wrap-break-word">
                open 等のため行を選択できません。locked / confirmed になってから補正してください。
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500 wrap-break-word">
                試合行（種別が割当済み）の行だけ選択できます。予約のみ・未編成の枠は選択できません。
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-3 sm:p-5">
            <h3 className="text-sm font-medium text-zinc-900">選択中の試合の編集</h3>
            {!selected ? (
              <p className="text-sm text-zinc-600">一覧から行を選択してください。</p>
            ) : (
            <div className="grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800">チームA（予約）</span>
                <select
                  value={reservationAId}
                  onChange={(e) => setReservationAId(e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation md:min-h-10 md:text-sm"
                >
                  {data.activeReservations
                    .filter((r) => r.id !== reservationBId)
                    .map((r) => (
                    <option key={r.id} value={r.id}>
                      {resLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800">チームB（予約）</span>
                <select
                  value={reservationBId}
                  onChange={(e) => setReservationBId(e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation md:min-h-10 md:text-sm"
                >
                  {data.activeReservations
                    .filter((r) => r.id !== reservationAId)
                    .map((r) => (
                    <option key={r.id} value={r.id}>
                      {resLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-zinc-800">審判（予約・任意）</span>
                <select
                  value={refereeReservationId}
                  onChange={(e) => setRefereeReservationId(e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation md:min-h-10 md:text-sm"
                >
                  <option value="">（審判なし）</option>
                  {data.activeReservations
                    .filter((r) => r.id !== reservationAId && r.id !== reservationBId)
                    .map((r) => (
                    <option key={r.id} value={r.id}>
                      {resLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-zinc-800">枠（event_day_slot）</span>
                {selected.matchPhase === "morning" ? (
                  <p className="text-xs leading-relaxed text-zinc-600">
                    午前試合の枠移動は未対応です。表示のみ:{" "}
                    <span className="font-mono">
                      {selected.slot?.slotCode ?? eventDaySlotId.slice(0, 8)}
                    </span>
                  </p>
                ) : (
                  <select
                    value={eventDaySlotId}
                    onChange={(e) => setEventDaySlotId(e.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 touch-manipulation md:min-h-10 md:text-sm"
                  >
                    {afternoonSlotChoices.map((s) => (
                      <option key={s.slotId} value={s.slotId}>
                        {s.slotCode} {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
                        {s.isActive === false ? "（無効枠）" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            )}

          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">補正理由（必須）</span>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={3}
              className="min-h-[88px] w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 touch-manipulation md:text-sm"
              placeholder="例: 予約の取り違えのため A 側を差し替え"
            />
          </label>

          {actionMessage ? (
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                actionMessage.includes("保存しました")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              role="status"
            >
              {actionMessage}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !assignmentId || !canPatch || !selected}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:min-h-11 sm:w-auto sm:text-sm"
          >
            {saving ? "保存中…" : "補正を保存"}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
