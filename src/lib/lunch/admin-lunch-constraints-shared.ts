/**
 * 管理画面クライアントと API で共有する昼食ガード用の定数・型。
 * `server-only` モジュールから import しないこと（クライアントバンドル可）。
 */

export const MIN_ACTIVE_LUNCH_MENUS = "minimum_active_lunch_menus" as const;
export const CUSTOM_DAY_LUNCH_NEEDS_ACTIVE =
  "custom_day_lunch_needs_active" as const;

export type LunchMenuOption = {
  id: string;
  name: string;
  is_active: boolean;
};
