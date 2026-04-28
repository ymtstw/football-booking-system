import "server-only";

/** 500 系・汎用（詳細はログへ） */
export const ADMIN_API_GENERIC_ERROR_JA =
  "処理に失敗しました。時間をおいて再度お試しください。";

/** 取得中心の処理が失敗したとき */
export const ADMIN_API_READ_ERROR_JA = "データの取得に失敗しました。";

/** 保存・更新・削除が失敗したとき */
export const ADMIN_API_SAVE_ERROR_JA = "保存に失敗しました。";

/**
 * 後方互換・既存 import 用（`ADMIN_API_GENERIC_ERROR_JA` と同じ文言）
 * @deprecated 新規は `ADMIN_API_GENERIC_ERROR_JA` / READ / SAVE を用途に合わせて使う
 */
export const ADMIN_API_DB_ERROR_JA = ADMIN_API_GENERIC_ERROR_JA;

export function logAdminApiDbError(context: string, err: unknown): void {
  console.error(`[admin-api] ${context}`, err);
}
