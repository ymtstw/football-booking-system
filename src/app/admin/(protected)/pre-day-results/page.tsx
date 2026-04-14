import { PreDayResultsClient } from "./pre-day-results-client";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

/** SCR-11: GET /api/admin/matches 表示、POST 編成・取り消し、meta 表示 */
export default async function AdminPreDayResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.date;
  const dateStr = typeof raw === "string" ? raw.trim() : "";
  const initialDate = dateStr && isIsoDateOnly(dateStr) ? dateStr : null;

  return <PreDayResultsClient initialDate={initialDate} />;
}
