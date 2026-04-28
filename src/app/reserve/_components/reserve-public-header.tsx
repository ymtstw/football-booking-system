"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IconArrowLeft, IconMenu, IconSoccerBall, IconX } from "./reserve-icons";
import {
  RESERVE_DATE_HEADER_BACK_REQUEST,
  RESERVE_DATE_PHASE_BROADCAST,
  type ReserveDatePhaseBroadcastDetail,
} from "@/lib/reserve/reserve-header-flow-events";
import { MANAGE_VIEW_TOKEN_SESSION_KEY } from "@/lib/reserve/manage-view-session";

const NAV = [
  {
    href: "/",
    label: "イベント案内",
    match: (p: string) =>
      p === "/" || p === "/reserve" || p === "/reserve/",
  },
  {
    href: "/reserve/calendar",
    label: "予約する",
    match: (p: string) =>
      p.startsWith("/reserve/calendar") ||
      /^\/reserve\/\d{4}-\d{2}-\d{2}/.test(p) ||
      p === "/reserve/complete",
  },
  { href: "/reserve/manage", label: "予約の確認・変更", match: (p: string) => p.startsWith("/reserve/manage") },
  {
    href: "/reserve/schedule",
    label: "開催確認・試合予定",
    match: (p: string) => p.startsWith("/reserve/schedule"),
  },
  { href: "/reserve/camp", label: "合宿のご相談", match: (p: string) => p.startsWith("/reserve/camp") },
  { href: "/reserve/contact", label: "お問い合わせ", match: (p: string) => p.startsWith("/reserve/contact") },
] as const;

const RESERVE_DATE_PATH_RE = /^\/reserve\/\d{4}-\d{2}-\d{2}$/;

/** 意味の切れ目の2行。各行 nowrap でカタカナ途中改行を防ぐ */
function BrandTitleTwoLines({ lineClassName }: { lineClassName: string }) {
  return (
    <span className="flex min-h-0 flex-col gap-0.5">
      <span className={`block whitespace-nowrap ${lineClassName}`}>小学生サッカー</span>
      <span className={`block whitespace-nowrap ${lineClassName}`}>対戦予約</span>
    </span>
  );
}

/** 戻るなしのスマホ：1行で正式名称（読みやすい最小サイズ） */
function BrandTitleOneLineMobile() {
  return (
    <span className="block whitespace-nowrap text-sm font-bold leading-tight tracking-tight text-green-800 sm:text-base">
      小学生サッカー対戦予約
    </span>
  );
}

type MobileBackSpec =
  | {
      mode: "link";
      href: string;
      line1: string;
      line2: string;
      title: string;
      ariaLabel: string;
      /** true のとき遷移前に予約詳細用トークンを sessionStorage から削除する */
      clearManageViewToken?: boolean;
    }
  | {
      mode: "button";
      line1: string;
      line2: string;
      title: string;
      ariaLabel: string;
    };

function mobileBackSpec(pathname: string, datePagePhase: "edit" | "confirm"): MobileBackSpec | null {
  if (!pathname.startsWith("/reserve")) return null;

  if (pathname.startsWith("/reserve/manage/view")) {
    return {
      mode: "link",
      href: "/reserve/manage",
      line1: "戻る",
      line2: "予約確認",
      title: "確認コードを入力する予約確認ページへ戻ります",
      ariaLabel: "予約確認ページへ戻る",
      clearManageViewToken: true,
    };
  }

  /** メインナビ直下・開催日選択カレンダーでは戻るを出さない */
  if (
    pathname.startsWith("/reserve/calendar") ||
    pathname.startsWith("/reserve/contact") ||
    pathname.startsWith("/reserve/camp") ||
    pathname.startsWith("/reserve/manage") ||
    pathname.startsWith("/reserve/schedule")
  ) {
    return null;
  }

  if (RESERVE_DATE_PATH_RE.test(pathname)) {
    if (datePagePhase === "confirm") {
      return {
        mode: "button",
        line1: "戻る",
        line2: "入力へ",
        title: "内容確認から入力画面に戻ります（同じ開催日）",
        ariaLabel: "内容確認から入力画面に戻る",
      };
    }
    return {
      mode: "button",
      line1: "戻る",
      line2: "開催日選択",
      title: "開催日を選び直す画面（カレンダー）へ戻ります",
      ariaLabel: "開催日選択へ戻る",
    };
  }
  if (pathname.startsWith("/reserve/complete")) {
    return {
      mode: "link",
      href: "/reserve/calendar",
      line1: "戻る",
      line2: "開催日選択",
      title: "開催日を選ぶページへ移動します",
      ariaLabel: "開催日選択ページへ戻る",
    };
  }
  /** 上記以外の /reserve 配下はナビ専用とみなし戻るなし（将来追加時も誤表示を防ぐ） */
  return null;
}

const mobileBackPillClass =
  "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-green-700 transition-colors hover:border-green-300 hover:bg-green-50/80 lg:hidden";

export function ReservePublicHeader() {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [datePagePhase, setDatePagePhase] = useState<"edit" | "confirm">("edit");

  const phaseForBack = RESERVE_DATE_PATH_RE.test(pathname) ? datePagePhase : "edit";
  const back = useMemo(() => mobileBackSpec(pathname, phaseForBack), [pathname, phaseForBack]);

  useEffect(() => {
    if (!RESERVE_DATE_PATH_RE.test(pathname)) return undefined;
    const handler = (e: Event) => {
      const d = (e as CustomEvent<ReserveDatePhaseBroadcastDetail>).detail;
      if (d?.phase === "edit" || d?.phase === "confirm") setDatePagePhase(d.phase);
    };
    window.addEventListener(RESERVE_DATE_PHASE_BROADCAST, handler);
    return () => window.removeEventListener(RESERVE_DATE_PHASE_BROADCAST, handler);
  }, [pathname]);

  const onDateHeaderBack = useCallback(() => {
    window.dispatchEvent(new CustomEvent(RESERVE_DATE_HEADER_BACK_REQUEST));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 top-[70px] bottom-0 z-0 bg-black/25 lg:hidden"
          aria-label="メニューを閉じる"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      {/* 縦方向の clip はしない（モバイルのドロップダウンナビが表示されるため） */}
      <div className="relative z-10 mx-auto flex h-[70px] max-w-[1280px] items-center justify-between gap-2.5 px-4 sm:gap-3 sm:px-6 md:px-8 lg:gap-4 lg:px-10">
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-3 sm:gap-4 lg:contents">
          {back ? (
            back.mode === "link" ? (
              <Link
                href={back.href}
                title={back.title}
                aria-label={back.ariaLabel}
                className={mobileBackPillClass}
                onClick={() => {
                  setMenuOpen(false);
                  if (back.clearManageViewToken) {
                    try {
                      sessionStorage.removeItem(MANAGE_VIEW_TOKEN_SESSION_KEY);
                    } catch {
                      /* ignore */
                    }
                  }
                }}
              >
                <IconArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="max-w-24 text-left leading-none">
                  <span className="block text-xs font-semibold text-green-800">{back.line1}</span>
                  <span className="mt-px block text-[10px] font-bold leading-tight text-green-900">
                    {back.line2}
                  </span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                title={back.title}
                aria-label={back.ariaLabel}
                className={mobileBackPillClass}
                onClick={() => {
                  setMenuOpen(false);
                  onDateHeaderBack();
                }}
              >
                <IconArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="max-w-24 text-left leading-none">
                  <span className="block text-xs font-semibold text-green-800">{back.line1}</span>
                  <span className="mt-px block text-[10px] font-bold leading-tight text-green-900">
                    {back.line2}
                  </span>
                </span>
              </button>
            )
          ) : null}
          <Link
            href="/"
            title="小学生サッカー対戦予約"
            className="flex min-h-0 min-w-0 flex-1 flex-row items-center gap-2 self-center text-green-700 sm:gap-2.5 lg:gap-3 xl:gap-3"
            onClick={() => setMenuOpen(false)}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-green-700 bg-white text-green-700 lg:h-10 lg:w-10">
              <IconSoccerBall className="h-4 w-4 lg:h-5 lg:w-5" strokeWidth={2} />
            </span>
            <span className="flex min-h-0 min-w-0 flex-1 flex-col justify-center pr-0.5 lg:min-w-0 lg:justify-center">
              {/* スマホ: 戻るで幅が狭いときは2行。戻るなしは1行の正式名 */}
              <span className="text-green-800 lg:hidden">
                {back ? (
                  <BrandTitleTwoLines lineClassName="text-xs font-bold leading-tight tracking-tight text-green-800 sm:text-sm" />
                ) : (
                  <BrandTitleOneLineMobile />
                )}
              </span>
              {/* PC: …省略にせず小さめ2行でヘッダー内に収める */}
              <span className="hidden text-green-800 lg:flex">
                <BrandTitleTwoLines lineClassName="text-[11px] font-bold leading-tight tracking-tight text-green-800 xl:text-sm" />
              </span>
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-green-700 sm:min-h-11 sm:min-w-11 lg:hidden"
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
        </div>
        <nav
          id="reserve-public-nav"
          className={`${
            menuOpen ? "flex" : "hidden"
          } absolute left-0 right-0 top-full z-50 flex-col gap-1 border-b border-slate-200 bg-white px-6 py-4 shadow-md lg:static lg:z-auto lg:flex lg:flex-row lg:items-end lg:gap-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none xl:gap-10`}
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
