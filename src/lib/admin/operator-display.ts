/**
 * 管理画面の「現場向け」表示用ヘルパー。
 * 内部ID・技術用語をそのまま出さない。
 */

import { gradeYearLabelJa } from "@/lib/reservations/grade-year";

/** 内部IDはフルUUIDを避け、末尾6文字のみ（照会用）。 */
export function formatAdminIdTail(id: string | null | undefined): string {
  if (id == null || String(id).trim() === "") return "—";
  const t = String(id).trim();
  return t.length <= 6 ? t : `…${t.slice(-6)}`;
}

export function formatAdminIdListTails(ids: string[]): string {
  if (!ids.length) return "なし";
  return ids.map((id) => formatAdminIdTail(id)).join(", ");
}

/** 枠コード末尾の番号（並び替え用） */
export function slotCodeOrderKey(slotCode: string): number {
  const m = slotCode.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]!, 10) : 0;
}

/** 例: MORNING_1 + morning → 午前1 */
export function eventSlotLabelJa(slotCode: string, phase: string): string {
  const phaseJa =
    phase === "morning" ? "午前" : phase === "afternoon" ? "午後" : phase;
  const n = slotCodeOrderKey(slotCode);
  return `${phaseJa}${n > 0 ? String(n) : ""}`;
}

/** match_assignments.assignment_type → 現場向け */
export function assignmentTypeLabelJa(t: string): string {
  switch (t) {
    case "morning_fill":
      return "午前の試合（補完）";
    case "afternoon_auto":
      return "午後の試合";
    case "morning_fixed":
      return "午前の試合";
    case "round_robin":
      return "総当たり";
    default:
      return t;
  }
}

/** 試合表一覧など短い種別ラベル（開発用キーはそのままフォールバック） */
export function assignmentTypeShortLabelJa(t: string): string {
  switch (t) {
    case "morning_fixed":
      return "既予約";
    case "morning_fill":
      return "補完";
    case "afternoon_auto":
      return "自動割当";
    case "round_robin":
      return "総当たり";
    default:
      return t;
  }
}

/** 一覧では学年・強さ区分を付けずチーム表示名のみ */
export function teamDisplayNameBare(s: {
  teamName: string | null;
  displayName: string | null;
  reservationId: string;
}): string {
  const base = s.teamName ?? s.displayName ?? formatAdminIdTail(s.reservationId);
  return base;
}

/** 対戦サブ行用（学年・強さ区分）。どちらも無ければ空文字 */
export function teamGradeCategoryDetailJa(s: {
  strengthCategory?: string | null;
  representativeGradeYear?: number | null;
}): string {
  const bits: string[] = [];
  const gy = s.representativeGradeYear;
  if (typeof gy === "number" && gy >= 1 && gy <= 6) bits.push(gradeYearLabelJa(gy));
  const c = s.strengthCategory?.trim();
  if (c) bits.push(c);
  return bits.join("・");
}

/** TableCellBeforeAfter 等で改行連結するとき */
export function matchVsTwoLineText(line1: string, line2: string | null): string {
  const t = line2?.trim();
  return t ? `${line1}\n${t}` : line1;
}

/** A/B の名前と詳細から対戦の2行を組み立て（詳細が両方空なら line2 は null） */
export function buildMatchVsLines(
  aName: string,
  bName: string,
  aDetail: string,
  bDetail: string
): { matchLine1: string; matchLine2: string | null } {
  const line1 = `${aName} vs ${bName}`;
  const da = aDetail.trim();
  const db = bDetail.trim();
  if (!da && !db) return { matchLine1: line1, matchLine2: null };
  const line2 = `${da || "—"} vs ${db || "—"}`;
  return { matchLine1: line1, matchLine2: line2 };
}
