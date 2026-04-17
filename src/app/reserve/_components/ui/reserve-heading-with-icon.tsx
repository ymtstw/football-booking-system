import type { ReactNode } from "react";

/** 見出し左の丸アイコン枠（フッター等とトーンを揃える） */
export const reserveIconShellClass: Record<
  "green" | "greenBare" | "navy" | "orange" | "orangeBare" | "zinc",
  string
> = {
  /** 緑背景上で白丸を付けずアイコンだけ（コールアウト先頭・情報カード見出しなど） */
  greenBare:
    "flex h-9 w-9 shrink-0 items-center justify-center text-green-800 sm:h-10 sm:w-10",
  green:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-green-700 shadow-sm ring-1 ring-green-200 sm:h-10 sm:w-10",
  navy:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rp-mint text-rp-brand shadow-sm ring-1 ring-rp-mint-2 sm:h-10 sm:w-10",
  /** オレンジ帯・カード上で白丸なし */
  orangeBare:
    "flex h-9 w-9 shrink-0 items-center justify-center text-orange-700 sm:h-10 sm:w-10",
  orange:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm ring-1 ring-orange-200 sm:h-10 sm:w-10",
  zinc:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200/80 text-zinc-600 ring-1 ring-zinc-300/80 sm:h-10 sm:w-10",
};

type HeadingTag = "h1" | "h2" | "h3";

/** 本文ブロック先頭の丸アイコンだけ（締切・天候など） */
export function ReserveLeadingIcon({
  shell,
  icon,
}: {
  shell: keyof typeof reserveIconShellClass;
  icon: ReactNode;
}) {
  return (
    <span className={reserveIconShellClass[shell]} aria-hidden>
      {icon}
    </span>
  );
}

export function ReserveHeadingWithIcon({
  as: El = "h2",
  shell,
  icon,
  children,
  className = "",
  textClassName = "",
}: {
  as?: HeadingTag;
  shell: keyof typeof reserveIconShellClass;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  textClassName?: string;
}) {
  return (
    <El className={`flex flex-wrap items-center gap-2.5 sm:gap-3 ${className}`}>
      <span className={reserveIconShellClass[shell]} aria-hidden>
        {icon}
      </span>
      <span className={`min-w-0 flex-1 ${textClassName}`}>{children}</span>
    </El>
  );
}
