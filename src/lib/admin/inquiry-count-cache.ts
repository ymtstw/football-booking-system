/**
 * 問い合わせ件数（ベル・一覧タブ）のキャッシュ版。
 * 全管理者で共通の数値なので、サービスロールで取得し 60 秒キャッシュする。
 * 作成・状態更新時は revalidateTag(INQUIRY_COUNTS_TAG) で即時無効化する。
 * 目的: 管理画面の各遷移で毎回走っていた count クエリを減らし、Disk IO を抑える。
 */
import "server-only";

import { unstable_cache } from "next/cache";

import type { InquiryListPeriod } from "@/lib/admin/inquiry-admin-list-query";
import {
  fetchInquiryBellCounts,
  fetchInquiryTabCountsForPage,
  type InquiryBellCounts,
  type InquiryTableName,
  type InquiryTabCounts,
} from "@/lib/admin/inquiry-count-queries";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** 問い合わせ件数キャッシュの無効化タグ（作成・状態更新時に revalidateTag する） */
export const INQUIRY_COUNTS_TAG = "admin-inquiry-counts";

/** キャッシュ保持秒数（複数管理者が連続で開いても DB 往復を抑える） */
const INQUIRY_COUNTS_TTL_SECONDS = 60;

/** ヘッダー・ナビの要対応件数（全管理者共通・60秒キャッシュ） */
export const getInquiryBellCountsCached = unstable_cache(
  async (): Promise<InquiryBellCounts> => {
    const supabase = createServiceRoleClient();
    return fetchInquiryBellCounts(supabase);
  },
  ["admin-inquiry-bell-counts"],
  { revalidate: INQUIRY_COUNTS_TTL_SECONDS, tags: [INQUIRY_COUNTS_TAG] }
);

/** 一覧タブの件数（テーブル・期間ごとにキャッシュ） */
export const getInquiryTabCountsCached = unstable_cache(
  async (
    table: InquiryTableName,
    period: InquiryListPeriod
  ): Promise<InquiryTabCounts> => {
    const supabase = createServiceRoleClient();
    return fetchInquiryTabCountsForPage(supabase, table, period);
  },
  ["admin-inquiry-tab-counts"],
  { revalidate: INQUIRY_COUNTS_TTL_SECONDS, tags: [INQUIRY_COUNTS_TAG] }
);
