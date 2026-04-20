"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminSignOutButton } from "./sign-out-button";

type AdminSection = "ops" | "reserve" | "prep" | "contact";

type SectionDef = {
  id: AdminSection;
  label: string;
  defaultHref: string;
  links: readonly { href: string; label: string }[];
};

const SECTIONS: readonly SectionDef[] = [
  {
    id: "ops",
    label: "運営",
    defaultHref: "/admin/dashboard",
    links: [
      { href: "/admin/dashboard", label: "ダッシュボード" },
      { href: "/admin/pre-day-results", label: "前日確定" },
    ],
  },
  {
    id: "reserve",
    label: "予約",
    defaultHref: "/admin/reservations",
    links: [{ href: "/admin/reservations", label: "予約一覧" }],
  },
  {
    id: "prep",
    label: "準備",
    defaultHref: "/admin/event-days",
    links: [
      { href: "/admin/event-days", label: "開催日" },
      { href: "/admin/lunch-menu", label: "昼食メニュー" },
    ],
  },
  {
    id: "contact",
    label: "連絡",
    defaultHref: "/admin/notifications/failed",
    links: [
      { href: "/admin/notifications/failed", label: "メール失敗" },
      { href: "/admin/camp-inquiries", label: "合宿相談" },
      { href: "/admin/tournament-inquiries", label: "大会お問い合わせ" },
    ],
  },
] as const;

/** モバイル左上アイコン背景（現在区分） */
const MOBILE_ICON_GRAD: Record<AdminSection, string> = {
  ops: "from-emerald-700 to-emerald-900",
  reserve: "from-sky-700 to-sky-900",
  prep: "from-amber-600 to-amber-800",
  contact: "from-violet-700 to-violet-900",
};

const SECTION_THEME: Record<
  AdminSection,
  { segmentActive: string; drawerTop: string; drawerIcon: string }
> = {
  ops: {
    segmentActive: "bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-900/20",
    drawerTop: "bg-emerald-600",
    drawerIcon: "text-emerald-700",
  },
  reserve: {
    segmentActive: "bg-sky-800 text-white shadow-sm ring-1 ring-sky-900/20",
    drawerTop: "bg-sky-600",
    drawerIcon: "text-sky-700",
  },
  prep: {
    segmentActive: "bg-amber-700 text-white shadow-sm ring-1 ring-amber-900/20",
    drawerTop: "bg-amber-500",
    drawerIcon: "text-amber-800",
  },
  contact: {
    segmentActive: "bg-violet-800 text-white shadow-sm ring-1 ring-violet-900/20",
    drawerTop: "bg-violet-600",
    drawerIcon: "text-violet-800",
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
    case "prep":
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
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "contact":
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
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    default:
      return null;
  }
}

function isSubnavCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/admin/event-days" && pathname.startsWith("/admin/event-days/")) return true;
  if (href === "/admin/reservations" && pathname.startsWith("/admin/reservations/")) return true;
  if (href === "/admin/camp-inquiries" && pathname.startsWith("/admin/camp-inquiries/")) return true;
  if (href === "/admin/tournament-inquiries" && pathname.startsWith("/admin/tournament-inquiries/"))
    return true;
  return false;
}

function resolveSection(pathname: string | null): AdminSection {
  if (!pathname) return "ops";
  if (pathname.startsWith("/admin/reservations")) return "reserve";
  if (pathname.startsWith("/admin/event-days") || pathname.startsWith("/admin/lunch-menu")) {
    return "prep";
  }
  if (
    pathname.startsWith("/admin/notifications") ||
    pathname.startsWith("/admin/camp-inquiries") ||
    pathname.startsWith("/admin/tournament-inquiries")
  ) {
    return "contact";
  }
  if (
    pathname.startsWith("/admin/dashboard") ||
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

type Props = {
  userEmail: string;
};

/** 業務4区分＋サブナビ。色・枠で区切りをはっきりさせる。 */
export function AdminProtectedHeader({ userEmail }: Props) {
  const pathname = usePathname();
  const activeSection = useMemo(() => resolveSection(pathname), [pathname]);
  const activeDef = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];
  const theme = SECTION_THEME[activeSection];

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

  const tabInactive =
    "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-white/90 hover:text-zinc-900 sm:flex-none sm:px-3.5";

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
          <span
            className="min-w-0 flex-1 truncate pl-1 text-xs text-zinc-600"
            title={userEmail || undefined}
          >
            {userEmail || "—"}
          </span>
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
                  予約・開催コンソール
                </span>
              </span>
            </Link>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
              {SECTIONS.map((sec) => {
                const isActive = sec.id === activeSection;
                const th = SECTION_THEME[sec.id];
                return (
                  <Link
                    key={sec.id}
                    href={sec.defaultHref}
                    className={`${tabInactive} ${isActive ? th.segmentActive : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <SectionIcon
                      id={sec.id}
                      className={isActive ? "text-white/90" : th.drawerIcon}
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
              {activeDef.links.map(({ href, label }) => {
                const isCurrent = isSubnavCurrent(pathname, href);
                return (
                  <Link
                    key={href}
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
                {SECTIONS.map((sec) => {
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
                        {sec.links.map(({ href, label }) => {
                          const isEventDays = href === "/admin/event-days";
                          const isRes = href === "/admin/reservations";
                          const isCamp = href === "/admin/camp-inquiries";
                          const isTournament = href === "/admin/tournament-inquiries";
                          const isCurrent =
                            pathname === href ||
                            (isEventDays && pathname?.startsWith("/admin/event-days/")) ||
                            (isRes && pathname?.startsWith("/admin/reservations/")) ||
                            (isCamp && pathname?.startsWith("/admin/camp-inquiries/")) ||
                            (isTournament && pathname?.startsWith("/admin/tournament-inquiries/"));
                          return (
                            <Link
                              key={href}
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
                        })}
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
