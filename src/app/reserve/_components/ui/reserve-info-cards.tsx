import type { ReactNode } from "react";

import { ReserveHeadingWithIcon } from "./reserve-heading-with-icon";

/** トップの 4 枚グリッド（スマホ 2×2 → md 以上 4 列） */
export function ReserveInfoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5">
      {children}
    </div>
  );
}

/** グリッド先頭のキャッチ用（アイコンなし想定。任意で装飾アイコン可） */
export function ReserveHeroPitchCard({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col justify-center gap-4 rounded-[20px] border border-green-200 bg-green-50 p-6 sm:min-h-[220px] sm:flex-row sm:items-center">
      {icon ? (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-full bg-white text-green-700 shadow-sm ring-1 ring-green-200 sm:h-16 sm:w-16 sm:self-center">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 text-center text-2xl font-extrabold leading-snug text-green-700 sm:text-left sm:text-3xl xl:text-4xl">
        {children}
      </div>
    </div>
  );
}

/**
 * スマホでもコンパクトに並ぶアイコン付きカード。
 * 2×2 グリッドの各セルとして使用する。
 */
export function ReserveInfoCard({
  title,
  icon,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-green-200 bg-green-50/70 p-3.5 sm:rounded-[20px] sm:p-5">
      {icon ? (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-green-700 shadow-sm ring-1 ring-green-200 sm:h-11 sm:w-11"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <h3 className="mt-2 text-sm font-bold leading-snug text-green-800 sm:text-base">
        {title}
      </h3>
      <div className="mt-1 text-xs leading-relaxed text-slate-700 sm:text-sm sm:leading-6">
        {children}
      </div>
    </div>
  );
}

/**
 * 従来のサイズが必要な場合のフル版情報カード（他画面から呼ばれている場合に備える）。
 * 現時点ではトップでは使わない。
 */
export function ReserveInfoCardLarge({
  title,
  icon,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-green-200 bg-green-50 p-6">
      {icon ? (
        <ReserveHeadingWithIcon
          as="h3"
          shell="greenBare"
          icon={icon}
          textClassName="text-xl font-bold text-green-700 sm:text-2xl"
        >
          {title}
        </ReserveHeadingWithIcon>
      ) : (
        <h3 className="text-xl font-bold text-green-700 sm:text-2xl">{title}</h3>
      )}
      <div className="mt-3 text-base leading-8 text-slate-800">{children}</div>
    </div>
  );
}
