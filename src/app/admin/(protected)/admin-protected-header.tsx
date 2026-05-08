"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { InquiryBellCounts } from "@/lib/admin/inquiry-count-queries";

import { AdminSignOutButton } from "./sign-out-button";
import { ADMIN_OPS_SECTION_LINKS } from "./admin-section-ops-links";

type AdminSection = "ops" | "reserve" | "inquiries" | "settings" | "guide";

type SectionDef = {
  id: AdminSection;
  label: string;
  defaultHref: string;
  links: readonly { href: string; label: string }[];
};

function buildSections(inquiry: InquiryBellCounts | null): readonly SectionDef[] {
  const campLabel =
    inquiry && inquiry.campTodo > 0 ? `合宿相談 · ${inquiry.campTodo}` : "合宿相談";
  const tourLabel =
    inquiry && inquiry.tournamentTodo > 0
      ? `お問い合わせ · ${inquiry.tournamentTodo}`
      : "お問い合わせ";
  const inqMain =
    inquiry && inquiry.totalOpen > 0 ? `問い合わせ · ${inquiry.totalOpen}` : "問い合わせ";

  return [
    {
      id: "ops",
      label: "開催運営",
      defaultHref: "/admin/dashboard",
      links: [...ADMIN_OPS_SECTION_LINKS],
    },
    {
      id: "reserve",
      label: "予約管理",
      defaultHref: "/admin/reservations",
      links: [{ href: "/admin/reservations", label: "予約を確認" }],
    },
    {
      id: "inquiries",
      label: inqMain,
      defaultHref: "/admin/camp-inquiries",
      links: [
        { href: "/admin/camp-inquiries", label: campLabel },
        { href: "/admin/tournament-inquiries", label: tourLabel },
      ],
    },
    {
      id: "settings",
      label: "設定",
      defaultHref: "/admin/lunch-menu",
      links: [{ href: "/admin/lunch-menu", label: "昼食メニュー設定" }],
    },
    {
      id: "guide",
      label: "ガイド",
      defaultHref: "/admin/guide",
      links: [{ href: "/admin/guide", label: "運営ガイド" }],
    },
  ];
}

/** モバイル左上アイコン背景（現在区分） */
const MOBILE_ICON_GRAD: Record<AdminSection, string> = {
  ops: "from-emerald-700 to-emerald-900",
  reserve: "from-sky-700 to-sky-900",
  inquiries: "from-violet-600 to-violet-900",
  settings: "from-amber-600 to-amber-800",
  guide: "from-emerald-600 to-teal-900",
};

const SECTION_THEME: Record<
  AdminSection,
  { segmentActive: string; drawerTop: string; drawerIcon: string }
> = {
  ops: {
    segmentActive:
      "bg-emerald-800 !text-white hover:!text-white shadow-sm ring-1 ring-emerald-900/20",
    drawerTop: "bg-emerald-600",
    drawerIcon: "text-emerald-700",
  },
  reserve: {
    segmentActive:
      "bg-sky-800 !text-white hover:!text-white shadow-sm ring-1 ring-sky-900/20",
    drawerTop: "bg-sky-600",
    drawerIcon: "text-sky-700",
  },
  inquiries: {
    segmentActive:
      "bg-violet-800 !text-white hover:!text-white shadow-sm ring-1 ring-violet-900/25",
    drawerTop: "bg-violet-600",
    drawerIcon: "text-violet-800",
  },
  settings: {
    segmentActive:
      "bg-amber-800 !text-white hover:!text-white shadow-sm ring-1 ring-amber-900/25",
    drawerTop: "bg-amber-500",
    drawerIcon: "text-amber-800",
  },
  guide: {
    segmentActive:
      "bg-emerald-800 !text-white hover:!text-white shadow-sm ring-1 ring-emerald-900/25",
    drawerTop: "bg-emerald-600",
    drawerIcon: "text-emerald-800",
  },
};

function SectionIcon({ id, className }: { id: AdminSection; className?: string }) {
  const cn = `h-[1.125rem] w-[1.125rem] shrink-0 ${className ?? ""}`;
  switch (id) {
    case "ops":
      return (
        <svg
          className={cn}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "reserve":
      return (
        <svg
          className={cn}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "inquiries":
      return (
        <svg
          className={cn}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "settings":
      return (
        <svg
          className={cn}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "guide":
      return (
        <svg
          className={cn}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
  }
}

/** `/admin/event-days/{uuid}` およびその配下（枠・通知など）からハブ URL を得る */
const EVENT_DAY_HUB_PATH =
  /^\/admin\/event-days\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function eventDayHubHrefFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(EVENT_DAY_HUB_PATH);
  return m ? `/admin/event-days/${m[1]}` : null;
}

function getOpsSubnavLinks(pathname: string | null): readonly { href: string; label: string }[] {
  const hub = eventDayHubHrefFromPathname(pathname);
  const base = [...ADMIN_OPS_SECTION_LINKS];
  if (!hub) return base;
  return [...base, { href: hub, label: "この日の運営画面" }];
}

function isSubnavCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  // 開催日の「まとめ」タブ: ハブ本体と枠・雨天・通知など同一開催の子ルート
  if (href.startsWith("/admin/event-days/") && EVENT_DAY_HUB_PATH.test(href)) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/admin/event-days") return pathname === "/admin/event-days";
  if (href === "/admin/notifications/failed" && pathname.startsWith("/admin/notifications")) return true;
  if (href === "/admin/camp-inquiries" && pathname.startsWith("/admin/camp-inquiries")) return true;
  if (href === "/admin/tournament-inquiries" && pathname.startsWith("/admin/tournament-inquiries"))
    return true;
  if (href === "/admin/reservations" && pathname.startsWith("/admin/reservations/")) return true;
  if (href === "/admin/lunch-menu" && pathname.startsWith("/admin/lunch-menu")) return true;
  if (href === "/admin/guide" && pathname.startsWith("/admin/guide")) return true;
  return false;
}

function resolveSection(pathname: string | null): AdminSection {
  if (!pathname) return "ops";
  if (pathname.startsWith("/admin/guide")) return "guide";
  if (pathname.startsWith("/admin/reservations")) return "reserve";
  if (pathname.startsWith("/admin/lunch-menu")) return "settings";
  if (pathname.startsWith("/admin/camp-inquiries") || pathname.startsWith("/admin/tournament-inquiries")) {
    return "inquiries";
  }
  if (pathname.startsWith("/admin/notifications")) return "ops";
  if (
    pathname.startsWith("/admin/dashboard") ||
    pathname.startsWith("/admin/event-days") ||
    pathname.startsWith("/admin/pre-day-results") ||
    pathname.startsWith("/admin/pre-day-adjust")
  ) {
    return "ops";
  }
  return "ops";
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function InquiryBellButton({ counts }: { counts: InquiryBellCounts }) {
  const n = counts.totalOpen;
  return (
    <div className="group relative shrink-0">
      <Link
        href="/admin/camp-inquiries"
        className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border shadow-sm ${
          n > 0
            ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100/90"
            : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
        }`}
        aria-label={
          n > 0
            ? `未対応の問い合わせが${n}件（合宿 ${counts.campTodo}・お問い合わせ ${counts.tournamentTodo}）`
            : "問い合わせを開く（要対応なし）"
        }
      >
        <BellIcon className="h-5 w-5" />
        {n > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white">
            {n > 99 ? "99+" : n}
          </span>
        ) : null}
      </Link>
      <div
        className="absolute right-0 top-full z-[60] mt-1 hidden w-[min(calc(100vw-2rem),16rem)] rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-lg ring-1 ring-zinc-100 md:block md:invisible md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:visible md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:opacity-100"
        role="region"
        aria-label="未対応の内訳"
      >
        {n > 0 ? (
          <>
            <p className="text-xs font-semibold text-zinc-800">未対応の内訳</p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
              <li className="flex justify-between gap-2">
                <span>合宿相談</span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {counts.campTodo}件
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>お問い合わせ</span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {counts.tournamentTodo}件
                </span>
              </li>
            </ul>
          </>
        ) : (
          <p className="text-xs text-zinc-600">いま、要対応の案件はありません。</p>
        )}
        <div className="mt-3 space-y-1 border-t border-zinc-100 pt-2">
          <Link
            href="/admin/camp-inquiries"
            className="block rounded-md px-2 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
          >
            合宿相談を開く →
          </Link>
          <Link
            href="/admin/tournament-inquiries"
            className="block rounded-md px-2 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
          >
            お問い合わせを開く →
          </Link>
        </div>
      </div>
    </div>
  );
}

type Props = {
  userEmail: string;
  /** レイアウトで取得。失敗時は null（ベルは描画しない） */
  inquiryBellCounts?: InquiryBellCounts | null;
};

/** 業務4区分＋サブナビ。色・枠で区切りをはっきりさせる。 */
export function AdminProtectedHeader({
  userEmail,
  inquiryBellCounts = null,
}: Props) {
  const pathname = usePathname();
  const sections = useMemo(
    () => buildSections(inquiryBellCounts ?? null),
    [inquiryBellCounts]
  );
  const activeSection = useMemo(() => resolveSection(pathname), [pathname]);
  const activeDef = sections.find((s) => s.id === activeSection) ?? sections[0];
  const theme = SECTION_THEME[activeSection];

  const subnavLinks = useMemo(() => {
    if (activeSection === "ops") return getOpsSubnavLinks(pathname);
    return activeDef.links;
  }, [activeSection, activeDef.links, pathname]);

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  /** 非選択の text-zinc-600 と選択の text-white がマージで競合しないよう、選択時は tabBase のみ＋ segmentActive */
  const tabBase =
    "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors sm:flex-none sm:px-3.5";
  const tabIdle = "text-zinc-600 hover:bg-white/90 hover:text-zinc-900";

  const subInactive =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900";
  const subActive =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/80";

  return (
    <header className="border-b border-zinc-200/90 bg-gradient-to-b from-white via-zinc-50/80 to-zinc-100/90 pt-[env(safe-area-inset-top,0px)] shadow-sm">
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-3 sm:px-5">
        {/* モバイル */}
        <div className="flex items-stretch justify-between gap-3 md:hidden">
          <Link
            href="/admin/dashboard"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-100"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md ring-2 ring-black/5 ${MOBILE_ICON_GRAD[activeSection]}`}
            >
              <SectionIcon id={activeSection} className="h-5 w-5 text-white/95" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold tracking-wide text-zinc-500">管理</span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-bold text-zinc-900">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${SECTION_THEME[activeSection].drawerTop}`}
                  aria-hidden
                />
                {activeDef.label}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center rounded-xl border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 active:scale-[0.98]"
            aria-expanded={menuOpen}
            aria-controls="admin-nav-drawer"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="sr-only">{menuOpen ? "メニューを閉じる" : "メニューを開く"}</span>
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white/60 px-2 py-1.5 md:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
            {inquiryBellCounts ? <InquiryBellButton counts={inquiryBellCounts} /> : null}
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600" title={userEmail || undefined}>
              {userEmail || "—"}
            </span>
          </div>
          <AdminSignOutButton />
        </div>

        {/* デスクトップ */}
        <div className="hidden flex-col gap-4 md:flex">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/admin/dashboard"
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 shadow-sm ring-1 ring-zinc-100 transition hover:border-emerald-200/80 hover:ring-emerald-100/60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-900 text-white shadow-md ring-2 ring-emerald-600/30">
                <SectionIcon id="ops" className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold tracking-wide text-zinc-500">管理</span>
                <span className="mt-0.5 block truncate text-base font-bold tracking-tight text-zinc-900 group-hover:text-emerald-950">
                  小学生サッカー対戦予約・開催コンソール
                </span>
              </span>
            </Link>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {inquiryBellCounts ? <InquiryBellButton counts={inquiryBellCounts} /> : null}
              <span
                className="max-w-[min(100vw,16rem)] truncate rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-right text-xs text-zinc-700 shadow-sm sm:max-w-[min(100%,240px)] sm:text-sm"
                title={userEmail || undefined}
              >
                {userEmail}
              </span>
              <AdminSignOutButton />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 bg-white/90 p-2 shadow-sm ring-1 ring-zinc-100/80 backdrop-blur-sm">
            <nav aria-label="メイン" className="flex flex-wrap gap-1 rounded-lg bg-zinc-100/90 p-1">
              {sections.map((sec) => {
                const isActive = sec.id === activeSection;
                const th = SECTION_THEME[sec.id];
                return (
                  <Link
                    key={sec.id}
                    href={sec.defaultHref}
                    className={isActive ? `${tabBase} ${th.segmentActive}` : `${tabBase} ${tabIdle}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <SectionIcon
                      id={sec.id}
                      className={isActive ? "!text-white/95" : th.drawerIcon}
                    />
                    {sec.label}
                  </Link>
                );
              })}
            </nav>

            <nav
              aria-label={`${activeDef.label}内のページ`}
              className="mt-2 flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-zinc-100 bg-zinc-50/90 p-1"
            >
              {subnavLinks.map(({ href, label }) => {
                const isCurrent = isSubnavCurrent(pathname, href);
                return (
                  <Link
                    key={`${href}-${label}`}
                    href={href}
                    className={isCurrent ? subActive : subInactive}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? theme.drawerTop : "bg-zinc-300"}`}
                      aria-hidden
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ドロワー */}
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-[2px] md:hidden"
              aria-label="メニューを閉じる"
              onClick={closeMenu}
            />
            <div
              id="admin-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="メニュー"
              className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw-1rem,21rem)] flex-col overflow-hidden border-l border-zinc-200/90 bg-white shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-4 py-3.5 text-white">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight">メニュー</p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/20"
                  aria-label="閉じる"
                  onClick={closeMenu}
                >
                  <HamburgerIcon open />
                </button>
              </div>

              <nav
                className="flex-1 space-y-3 overflow-y-auto overscroll-y-contain bg-zinc-100/80 px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                aria-label="区分別リンク"
              >
                {sections.map((sec) => {
                  const th = SECTION_THEME[sec.id];
                  return (
                    <div
                      key={sec.id}
                      className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm"
                    >
                      <div className={`h-1 w-full ${th.drawerTop}`} aria-hidden />
                      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 ${th.drawerIcon}`}
                        >
                          <SectionIcon id={sec.id} className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold text-zinc-900">{sec.label}</span>
                      </div>
                      <div className="space-y-0.5 p-2">
                        {(sec.id === "ops" ? getOpsSubnavLinks(pathname) : sec.links).map(
                          ({ href, label }) => {
                            const isCurrent = isSubnavCurrent(pathname, href);
                            return (
                              <Link
                                key={`${href}-${label}`}
                                href={href}
                                className={
                                  isCurrent
                                    ? "flex min-h-11 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-white shadow-sm"
                                    : "flex min-h-11 items-center rounded-lg border border-transparent px-3 text-sm font-medium text-zinc-800 hover:border-zinc-200 hover:bg-zinc-50"
                                }
                                aria-current={isCurrent ? "page" : undefined}
                                onClick={closeMenu}
                              >
                                {label}
                              </Link>
                            );
                          }
                        )}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
