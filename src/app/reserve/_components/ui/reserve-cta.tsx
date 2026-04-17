import Link from "next/link";
import type { ReactNode } from "react";

import {
  IconArrowRight,
  IconHome,
} from "../reserve-icons";

const primaryLarge =
  "inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-green-600 px-10 py-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-green-700 sm:min-h-14 sm:px-12 sm:text-xl md:text-2xl";

const primaryMedium =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-green-600 px-8 text-base font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 lg:ml-auto lg:w-auto lg:min-w-[18rem]";

const outlineRound =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-green-700 bg-white px-6 text-base font-bold text-green-800 transition-colors hover:bg-green-50 lg:w-auto";

const softGreen =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-green-200 bg-green-50/80 px-5 text-sm font-semibold text-green-900 transition-colors hover:bg-green-50 lg:w-auto";

/** トップの「開催日を確認する」など大きな緑CTA */
export function ReservePrimaryCtaLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={primaryLarge}>
      {children}
      <IconArrowRight
        className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
        strokeWidth={2.5}
      />
    </Link>
  );
}

/** カレンダー画面フッターなど中サイズの緑ボタン */
export function ReservePrimaryCtaButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" {...props} className={`${primaryMedium} ${className}`}>
      {children}
      <IconArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} />
    </button>
  );
}

/** 白抜きの丸枠リンク（戻る） */
export function ReserveOutlineRoundLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={outlineRound}>
      {children}
    </Link>
  );
}

/** 薄緑のサブCTA（合宿など） */
export function ReserveSoftGreenLink({
  href,
  children,
  showHomeIcon = true,
}: {
  href: string;
  children: ReactNode;
  showHomeIcon?: boolean;
}) {
  return (
    <Link href={href} className={softGreen}>
      {showHomeIcon ? (
        <IconHome className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      ) : null}
      {children}
    </Link>
  );
}
