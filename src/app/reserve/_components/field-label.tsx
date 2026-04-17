import type { ReactNode } from "react";

export function FieldLabel({
  children,
  required: isReq,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm font-medium text-zinc-800">
      {children}
      {isReq ? (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
          必須
        </span>
      ) : null}
    </span>
  );
}
