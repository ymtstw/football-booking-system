/**
 * 管理画面の「現場向け」表示用ヘルパー。
 * 内部ID・技術用語をそのまま出さない。
 */

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
      return "午前・補完";
    case "afternoon_auto":
      return "午後・自動割当";
    case "morning_fixed":
      return "午前・確定試合";
    default:
      return t;
  }
}
