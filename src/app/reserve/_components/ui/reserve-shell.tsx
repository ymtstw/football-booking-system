import type { ReactNode } from "react";

import { ReserveHeadingWithIcon } from "./reserve-heading-with-icon";

/** 画面のメイン白パネル（トップ等） */
export function ReserveMainShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 md:p-10 ${className}`}
    >
      {children}
    </section>
  );
}

/** カレンダー枠などの白サブパネル */
export function ReserveSubPanel({
  title,
  titleIcon,
  description,
  children,
  className = "",
}: {
  title?: string;
  /** 見出し左のアイコン（線画 SVG 推奨） */
  titleIcon?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      {title && titleIcon ? (
        <ReserveHeadingWithIcon
          as="h2"
          shell="navy"
          icon={titleIcon}
          textClassName="text-xl font-bold text-slate-900"
        >
          {title}
        </ReserveHeadingWithIcon>
      ) : title ? (
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      ) : null}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </div>
  );
}
