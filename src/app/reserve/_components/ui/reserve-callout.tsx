import type { ReactNode } from "react";

const toneClass: Record<
  "green" | "orange" | "red" | "slate",
  string
> = {
  green: "border-green-200 bg-green-50/90",
  orange: "border-orange-200 bg-orange-50",
  red: "border-red-200 bg-red-50 text-red-800",
  slate: "border-slate-200 bg-white text-slate-600",
};

/** 注意・説明・エラーなどの囲み（角丸・枠線を統一。余白は className で指定） */
export function ReserveCallout({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof toneClass;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[16px] border sm:rounded-[20px] ${toneClass[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
