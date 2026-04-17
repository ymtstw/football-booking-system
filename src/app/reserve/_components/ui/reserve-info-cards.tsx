import type { ReactNode } from "react";

import { ReserveHeadingWithIcon } from "./reserve-heading-with-icon";

/** トップの4枚グリッド */
export function ReserveInfoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

/** 左端の大きめキャッチカード（feature: グラウンド訴求バナー PNG などを大きく表示） */
export function ReserveHeroPitchCard({
  children,
  icon,
  feature = false,
}: {
  children: ReactNode;
  icon?: ReactNode;
  /** true のとき白丸なしでワイド表示（モック左列の訴求ビジュアル用） */
  feature?: boolean;
}) {
  if (feature && icon) {
    return (
      <div className="flex min-h-[200px] flex-col justify-center gap-5 rounded-[20px] border border-green-200 bg-green-50 p-5 sm:min-h-[220px] sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="relative mx-auto h-36 w-full max-w-[260px] shrink-0 sm:mx-0 sm:h-40 sm:w-44">
          {icon}
        </div>
        <div className="min-w-0 text-center text-2xl font-extrabold leading-snug text-green-700 sm:text-left sm:text-3xl xl:text-4xl">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[200px] flex-col justify-center gap-4 rounded-[20px] border border-green-200 bg-green-50 p-6 sm:min-h-[220px] sm:flex-row sm:items-center">
      {icon ? (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-full bg-white text-green-700 shadow-sm ring-1 ring-green-200 sm:h-16 sm:w-16 sm:self-center">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 text-2xl font-extrabold leading-snug text-green-700 sm:text-3xl xl:text-4xl">
        {children}
      </div>
    </div>
  );
}

/** 説明用の緑枠カード */
export function ReserveInfoCard({
  title,
  icon,
  children,
}: {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-green-200 bg-green-50 p-6">
      <ReserveHeadingWithIcon
        as="h3"
        shell="greenBare"
        icon={icon}
        textClassName="text-xl font-bold text-green-700 sm:text-2xl"
      >
        {title}
      </ReserveHeadingWithIcon>
      <div className="mt-3 text-base leading-8 text-slate-800">{children}</div>
    </div>
  );
}
