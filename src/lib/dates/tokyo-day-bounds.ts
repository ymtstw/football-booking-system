const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `YYYY-MM-DD`（開催日カレンダー／送信処理日の暦日）を、東京のその日 0:00〜翌日 0:00（左閉右開）の UTC ISO に変換する。
 * DB の `timestamptz` と比較するフィルタ用。
 */
export function tokyoDayStartEndExclusiveUtcIso(yyyyMmDd: string): {
  startIsoUtc: string;
  endExclusiveIsoUtc: string;
} | null {
  const s = yyyyMmDd.trim();
  if (!ISO_DATE.test(s)) return null;
  const start = new Date(`${s}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  const endExclusive = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIsoUtc: start.toISOString(),
    endExclusiveIsoUtc: endExclusive.toISOString(),
  };
}

/** 画面用 `YYYY/MM/DD` */
export function formatSlashDateJa(yyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return yyyyMmDd.trim();
  return `${m[1]}/${m[2]}/${m[3]}`;
}
