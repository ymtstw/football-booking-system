/** 開催運営サブナビ（ヘッダー・ドロワー・getOpsSubnavLinks で共通） */
export const ADMIN_OPS_SECTION_LINKS = [
  { href: "/admin/dashboard", label: "直近の開催日" },
  { href: "/admin/event-days", label: "開催日の登録・管理" },
  { href: "/admin/pre-day-results", label: "試合表・編成" },
  { href: "/admin/notifications/failed", label: "メール送信履歴" },
] as const;
