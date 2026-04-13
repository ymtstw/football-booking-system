/** 管理「開催日一覧」の件数・取得上限（過負荷防止） */

/** 基準開催日より前（いわゆる「過去」側。開催日が新しい方から最大何件か）— 仕様上 2〜3 件想定で 3 固定 */
export const ADMIN_EVENT_DAY_LIST_BEFORE_ANCHOR = 3;
/** 基準開催日以降（当日を含む「今日以降／未来」）の最大件数 */
export const ADMIN_EVENT_DAY_LIST_FROM_ANCHOR = 20;
/** 開催カレンダー用の軽量行の最大件数 */
export const ADMIN_EVENT_DAY_CALENDAR_MAX = 2000;
