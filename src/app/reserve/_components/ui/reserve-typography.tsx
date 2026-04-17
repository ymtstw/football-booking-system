import type { ReactNode } from "react";

import { ReserveHeadingWithIcon } from "./reserve-heading-with-icon";

export function ReservePageTitle({
  children,
  icon,
  iconShell = "green",
}: {
  children: ReactNode;
  /** 指定時は見出し左にアイコン枠を付ける */
  icon?: ReactNode;
  iconShell?: "green" | "navy";
}) {
  if (icon) {
    return (
      <ReserveHeadingWithIcon
        as="h1"
        shell={iconShell}
        icon={icon}
        textClassName="text-[clamp(1.75rem,4vw,3.25rem)] font-extrabold leading-tight tracking-tight text-slate-900"
      >
        {children}
      </ReserveHeadingWithIcon>
    );
  }
  return (
    <h1 className="text-[clamp(1.75rem,4vw,3.25rem)] font-extrabold leading-tight tracking-tight text-slate-900">
      {children}
    </h1>
  );
}

export function ReserveLead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-base leading-relaxed text-slate-700 sm:text-lg">
      {children}
    </p>
  );
}

export function ReserveSectionHeading({
  as: Tag = "h2",
  tone = "orange",
  icon,
  children,
}: {
  as?: "h2" | "h3";
  tone?: "orange" | "green";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const toneClass =
    tone === "orange" ? "text-orange-600" : "text-green-700";
  const shell = tone === "orange" ? "orangeBare" : "greenBare";
  if (icon) {
    return (
      <ReserveHeadingWithIcon
        as={Tag}
        shell={shell}
        icon={icon}
        textClassName={`text-2xl font-bold sm:text-3xl ${toneClass}`}
      >
        {children}
      </ReserveHeadingWithIcon>
    );
  }
  return (
    <Tag className={`text-2xl font-bold sm:text-3xl ${toneClass}`}>
      {children}
    </Tag>
  );
}
