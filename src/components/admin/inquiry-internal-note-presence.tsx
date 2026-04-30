/** 一覧用: 対応メモの有無のみ（本文は出さない） */
export function InquiryInternalNotePresenceLabel({
  internalNote,
}: {
  internalNote: string | null;
}) {
  const has = Boolean(internalNote?.trim());
  return (
    <span
      className={`text-xs font-medium sm:text-sm ${has ? "text-emerald-800" : "text-zinc-400"}`}
      title={has ? "対応メモが登録されています" : "対応メモは未登録です"}
    >
      {has ? "あり" : "—"}
    </span>
  );
}
