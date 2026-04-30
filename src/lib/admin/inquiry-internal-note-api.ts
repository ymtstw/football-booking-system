/** 管理画面の問い合わせ・合宿相談 PATCH 用: internal_note の検証と patch への反映 */

export const INQUIRY_INTERNAL_NOTE_MAX_LEN = 2000;

export function appendInternalNoteToPatchIfPresent(
  body: Record<string, unknown>,
  patch: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
  if (!Object.prototype.hasOwnProperty.call(body, "internal_note")) {
    return { ok: true };
  }
  const raw = body.internal_note;
  if (raw === null || raw === undefined) {
    patch.internal_note = null;
    return { ok: true };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "internal_note は文字列または null です" };
  }
  const t = raw.trim();
  if (t.length > INQUIRY_INTERNAL_NOTE_MAX_LEN) {
    return {
      ok: false,
      error: `対応メモは ${INQUIRY_INTERNAL_NOTE_MAX_LEN} 文字以内にしてください`,
    };
  }
  patch.internal_note = t.length === 0 ? null : t;
  return { ok: true };
}
