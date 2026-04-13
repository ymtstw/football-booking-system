/**
 * `event_days.event_date` 等をカレンダーグリッドの `YYYY-MM-DD` と突き合わせる用。
 * PostgREST/クライアントにより `2026-04-24T00:00:00+00:00` のように返る場合も先頭10文字で揃える。
 */
export function toIsoDateKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : null;
}
