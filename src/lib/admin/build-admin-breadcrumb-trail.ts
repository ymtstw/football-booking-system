/** 管理画面のグローバルパンくず用。URL から論理階層を組み立てる（履歴バックは使わない）。 */

export type AdminBreadcrumbSegment =
  | { kind: "link"; href: string; label: string }
  | { kind: "current"; label: string };

const DASHBOARD: AdminBreadcrumbSegment = {
  kind: "link",
  href: "/admin/dashboard",
  label: "ダッシュボード",
};

/** 開催日まわりの子画面はページ側の EventDayOpsBreadcrumb と二重になるためグローバルは出さない */
export function pathUsesEventDayOpsBreadcrumb(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || pathname;
  return /^\/admin\/event-days\/[^/]+\/(slots\/force|weather|slots|notifications|operational-cancel)$/.test(
    p
  );
}

/**
 * グローバルパンくずのセグメント。表示しないときは null（ダッシュボード直下・開催日子画面など）。
 */
export function buildAdminBreadcrumbTrail(pathname: string): AdminBreadcrumbSegment[] | null {
  const p = pathname.replace(/\/+$/, "") || pathname;

  if (p === "/admin/dashboard") return null;
  if (pathUsesEventDayOpsBreadcrumb(p)) return null;

  if (p === "/admin/pre-day-results") {
    return [DASHBOARD, { kind: "current", label: "試合表・編成" }];
  }

  if (p === "/admin/event-days") {
    return [DASHBOARD, { kind: "current", label: "開催日の登録・管理" }];
  }

  const hubOnly = p.match(/^\/admin\/event-days\/([^/]+)$/);
  if (hubOnly) {
    return [
      DASHBOARD,
      { kind: "link", href: "/admin/event-days", label: "開催日の登録・管理" },
      { kind: "current", label: "この日の運営画面" },
    ];
  }

  if (p === "/admin/reservations") {
    return [DASHBOARD, { kind: "current", label: "予約を確認" }];
  }

  const resDetail = p.match(/^\/admin\/reservations\/([^/]+)$/);
  if (resDetail) {
    return [
      DASHBOARD,
      { kind: "link", href: "/admin/reservations", label: "予約を確認" },
      { kind: "current", label: "予約の詳細" },
    ];
  }

  if (p === "/admin/lunch-menu") {
    return [DASHBOARD, { kind: "current", label: "昼食メニュー設定" }];
  }

  if (p === "/admin/guide") {
    return [DASHBOARD, { kind: "current", label: "運営ガイド" }];
  }

  if (p === "/admin/notifications/failed") {
    return [DASHBOARD, { kind: "current", label: "メール送信履歴" }];
  }

  if (p === "/admin/camp-inquiries") {
    return [DASHBOARD, { kind: "current", label: "合宿相談一覧" }];
  }

  const campDetail = p.match(/^\/admin\/camp-inquiries\/([^/]+)$/);
  if (campDetail) {
    return [
      DASHBOARD,
      { kind: "link", href: "/admin/camp-inquiries", label: "合宿相談一覧" },
      { kind: "current", label: "合宿相談の詳細" },
    ];
  }

  if (p === "/admin/tournament-inquiries") {
    return [DASHBOARD, { kind: "current", label: "お問い合わせ一覧" }];
  }

  const tournamentDetail = p.match(/^\/admin\/tournament-inquiries\/([^/]+)$/);
  if (tournamentDetail) {
    return [
      DASHBOARD,
      { kind: "link", href: "/admin/tournament-inquiries", label: "お問い合わせ一覧" },
      { kind: "current", label: "お問い合わせの詳細" },
    ];
  }

  if (p.startsWith("/admin/")) {
    return [DASHBOARD, { kind: "current", label: "管理" }];
  }

  return null;
}
