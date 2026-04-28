"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

type Props = {
  title: string;
  /** 閉じているとき見出し横に表示する要約（1行目詰め） */
  sectionPreview: string;
  /** モバイル `<details>` の初期開閉 */
  defaultOpen?: boolean;
  /** アンカー用（例: team-contact）。PC の `<section>` とモバイルの `<details>` の両方に付与 */
  anchorId?: string;
  children: ReactNode;
};

/** 768px 未満のみ `<details>`。`md` 以上は従来のカード `<section>`。 */
export function ReservationDetailCollapsibleMobile({
  title,
  sectionPreview,
  defaultOpen = false,
  anchorId,
  children,
}: Props) {
  const [wide, setWide] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultOpen);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (wide) {
    return (
      <section
        id={anchorId}
        className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <div className="mt-4 min-w-0">{children}</div>
      </section>
    );
  }

  return (
    <details
      open={detailsOpen}
      onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
      id={anchorId}
      className="group scroll-mt-24 rounded-lg border border-zinc-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {sectionPreview}
          </span>
        </span>
        <span
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 group-open:rotate-180 motion-safe:transition-transform"
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
