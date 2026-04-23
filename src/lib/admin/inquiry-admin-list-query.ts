/**
 * 管理画面の問い合わせ一覧（合宿相談・大会お問い合わせ）のタブ・期間クエリ。
 * 要対応／対応中は期間なし。対応済み／すべてのみ直近30日ローリング or それ以前。
 */

export type InquiryListTab = "todo" | "in_progress" | "done" | "all";

export type InquiryListPeriod = "recent" | "older";

function firstString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    const t = v[0].trim();
    return t.length > 0 ? t : undefined;
  }
  return undefined;
}

const VALID_TABS = new Set<string>(["todo", "in_progress", "done", "all"]);

/** 旧 ?status= のブックマーク向け */
function tabFromLegacyStatus(status: string | undefined): InquiryListTab | null {
  if (!status) return null;
  if (status === "new" || status === "follow_up") return "todo";
  if (status === "in_progress") return "in_progress";
  if (status === "done") return "done";
  return null;
}

export function parseInquiryListQuery(params: {
  tab?: string | string[] | undefined;
  period?: string | string[] | undefined;
  status?: string | string[] | undefined;
}): { tab: InquiryListTab; period: InquiryListPeriod } {
  const tabRaw = firstString(params.tab);
  const periodRaw = firstString(params.period);
  const statusRaw = firstString(params.status);

  let tab: InquiryListTab = "todo";
  if (tabRaw && VALID_TABS.has(tabRaw)) {
    tab = tabRaw as InquiryListTab;
  } else {
    const mapped = tabFromLegacyStatus(statusRaw);
    if (mapped) tab = mapped;
  }

  let period: InquiryListPeriod = "recent";
  if (tab === "done" || tab === "all") {
    if (periodRaw === "older") period = "older";
  }
  return { tab, period };
}

/** ローリング30日前の境界（UTC ISO）。created_at >= 直近、< がそれ以前 */
export function rollingThirtyDaysCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - 30 * 86_400_000).toISOString();
}

export type InquiryListHrefBase =
  | "/admin/camp-inquiries"
  | "/admin/tournament-inquiries";

/** 一覧へのリンク（todo はクエリなし） */
export function inquiryListHref(
  base: InquiryListHrefBase,
  tab: InquiryListTab,
  period: InquiryListPeriod
): string {
  if (tab === "todo") return base;
  if (tab === "in_progress") return `${base}?tab=in_progress`;
  const p = period === "older" ? "older" : "recent";
  if (p === "recent") return `${base}?tab=${tab}`;
  return `${base}?tab=${tab}&period=older`;
}

/** Supabase 一覧クエリに載せる条件（いずれかのみセット） */
export function inquiryListSupabaseFilters(
  tab: InquiryListTab,
  period: InquiryListPeriod,
  cutoffIso: string
): {
  statusIn?: readonly string[];
  statusEq?: string;
  createdGte?: string;
  createdLt?: string;
} {
  if (tab === "todo") return { statusIn: ["new", "follow_up"] };
  if (tab === "in_progress") return { statusEq: "in_progress" };
  if (tab === "done") {
    if (period === "recent") return { statusEq: "done", createdGte: cutoffIso };
    return { statusEq: "done", createdLt: cutoffIso };
  }
  if (period === "recent") return { createdGte: cutoffIso };
  return { createdLt: cutoffIso };
}
