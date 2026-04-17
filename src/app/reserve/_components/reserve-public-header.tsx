"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { IconMenu, IconSoccerBall, IconX } from "./reserve-icons";

const NAV = [
  {
    href: "/reserve",
    label: "予約",
    match: (p: string) =>
      p === "/reserve" ||
      p.startsWith("/reserve/calendar") ||
      /^\/reserve\/\d{4}-\d{2}-\d{2}$/.test(p) ||
      p === "/reserve/complete",
  },
  { href: "/reserve/manage", label: "予約の確認・キャンセル", match: (p: string) => p.startsWith("/reserve/manage") },
  { href: "/reserve/camp", label: "合宿のご相談", match: (p: string) => p.startsWith("/reserve/camp") },
  { href: "/reserve/contact", label: "お問い合わせ", match: (p: string) => p.startsWith("/reserve/contact") },
] as const;

export function ReservePublicHeader() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-6 md:px-8 lg:px-10">
        <Link
          href="/reserve"
          className="flex min-w-0 items-center gap-3 text-green-700"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-green-700 bg-white text-green-700">
            <IconSoccerBall className="h-5 w-5" />
          </span>
          <span className="truncate text-xl font-extrabold tracking-tight text-green-700 sm:text-2xl md:text-3xl">
            小学生サッカー対戦予約
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-green-700 lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="reserve-public-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sr-only">メニュー</span>
          {menuOpen ? (
            <IconX className="h-6 w-6" strokeWidth={2} />
          ) : (
            <IconMenu className="h-6 w-6" strokeWidth={2} />
          )}
        </button>
        <nav
          id="reserve-public-nav"
          className={`${
            menuOpen ? "flex" : "hidden"
          } absolute left-0 right-0 top-[72px] flex-col gap-1 border-b border-slate-200 bg-white px-6 py-4 shadow-md lg:static lg:flex lg:flex-row lg:items-end lg:gap-10 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          {NAV.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`min-h-11 rounded-lg px-2 py-2 text-base font-bold lg:min-h-0 lg:border-b-4 lg:pb-4 lg:pt-1 ${
                  active
                    ? "bg-green-50 text-green-700 lg:border-green-700 lg:bg-transparent"
                    : "text-slate-700 hover:bg-slate-50 lg:border-transparent lg:hover:bg-transparent lg:hover:text-green-800"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
