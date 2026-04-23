import "server-only";

/** 参照系（開催日一覧・空き・スケジュール閲覧・予約の取得など） */
export const PUBLIC_RESERVE_API_READ_ERROR_JA =
  "ただいま情報を表示できません。しばらくしてから再度お試しください。";

/** 更新系（予約の作成・変更・取消・問い合わせ送信など） */
export const PUBLIC_RESERVE_API_WRITE_ERROR_JA =
  "ただいま処理を完了できません。しばらくしてから再度お試しください。";

type SupabaseLikeError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

/** 利用者には返さず、サーバーログのみに残す */
export function logPublicReserveApiSupabaseError(
  context: string,
  err: SupabaseLikeError
): void {
  console.error(`[public-reserve-api] ${context}`, {
    code: err.code,
    message: err.message,
    details: err.details,
    hint: err.hint,
  });
}
