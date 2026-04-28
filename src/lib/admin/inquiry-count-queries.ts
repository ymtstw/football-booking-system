/**
 * 管理画面「対応案件」の件数（ヘッダー・タブ表示用）。
 * inquiryListSupabaseFilters と同じ条件で count のみ取得する。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type InquiryListPeriod,
  type InquiryListTab,
  inquiryListSupabaseFilters,
  rollingThirtyDaysCutoffIso,
} from "@/lib/admin/inquiry-admin-list-query";

export type InquiryTableName = "camp_inquiries" | "tournament_inquiries";

export type InquiryBellCounts = {
  campTodo: number;
  tournamentTodo: number;
  totalOpen: number;
};

export type InquiryTabCounts = {
  todo: number;
  inProgress: number;
  done: number;
  all: number;
};

async function countFiltered(
  supabase: SupabaseClient,
  table: InquiryTableName,
  tab: InquiryListTab,
  period: InquiryListPeriod,
  cutoffIso: string
): Promise<number> {
  const filters = inquiryListSupabaseFilters(tab, period, cutoffIso);
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  if (filters.statusIn) {
    query = query.in("status", [...filters.statusIn]);
  }
  if (filters.statusEq) {
    query = query.eq("status", filters.statusEq);
  }
  if (filters.createdGte) {
    query = query.gte("created_at", filters.createdGte);
  }
  if (filters.createdLt) {
    query = query.lt("created_at", filters.createdLt);
  }

  const { count, error } = await query;
  if (error) {
    console.warn(`[inquiry counts] ${table} tab=${tab} period=${period}`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** ベル・ナビ用: 要対応（未対応 new + 要再対応 follow_up）のみ */
export async function fetchInquiryBellCounts(
  supabase: SupabaseClient
): Promise<InquiryBellCounts> {
  const cutoffIso = rollingThirtyDaysCutoffIso();
  const [campTodo, tournamentTodo] = await Promise.all([
    countFiltered(supabase, "camp_inquiries", "todo", "recent", cutoffIso),
    countFiltered(supabase, "tournament_inquiries", "todo", "recent", cutoffIso),
  ]);
  return {
    campTodo,
    tournamentTodo,
    totalOpen: campTodo + tournamentTodo,
  };
}

/** 一覧タブ横の件数（対応済み・すべては現在の period に合わせる） */
export async function fetchInquiryTabCountsForPage(
  supabase: SupabaseClient,
  table: InquiryTableName,
  period: InquiryListPeriod
): Promise<InquiryTabCounts> {
  const cutoffIso = rollingThirtyDaysCutoffIso();
  const [todo, inProgress, done, all] = await Promise.all([
    countFiltered(supabase, table, "todo", "recent", cutoffIso),
    countFiltered(supabase, table, "in_progress", "recent", cutoffIso),
    countFiltered(supabase, table, "done", period, cutoffIso),
    countFiltered(supabase, table, "all", period, cutoffIso),
  ]);
  return { todo, inProgress, done, all };
}
