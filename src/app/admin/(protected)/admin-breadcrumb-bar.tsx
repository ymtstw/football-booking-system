"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  buildAdminBreadcrumbTrail,
  type AdminBreadcrumbSegment,
} from "@/lib/admin/build-admin-breadcrumb-trail";

function segmentKey(seg: AdminBreadcrumbSegment, index: number): string {
  return seg.kind === "link" ? `${seg.href}-${index}` : `current-${seg.label}-${index}`;
}

/** 保護レイアウト直下のグローバルパンくず（開催日の子画面はページ側パンくずと役割分担） */
export function AdminBreadcrumbBar() {
  const pathname = usePathname();
  const trail = pathname ? buildAdminBreadcrumbTrail(pathname) : null;
  if (!trail?.length) return null;

  return (
    <nav
      aria-label="パンくず"
      className="mb-5 rounded-xl border border-zinc-200/90 bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-zinc-100/80 sm:px-4"
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-zinc-600">
        {trail.map((seg, index) => (
          <li key={segmentKey(seg, index)} className="flex min-w-0 items-center">
            {index > 0 ? (
              <span className="mx-1.5 shrink-0 text-zinc-300 select-none" aria-hidden>
                /
              </span>
            ) : null}
            {seg.kind === "link" ? (
              <Link
                href={seg.href}
                className="min-w-0 truncate font-medium text-zinc-700 underline decoration-zinc-400/80 underline-offset-2 hover:text-zinc-950"
              >
                {seg.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-semibold text-zinc-900" aria-current="page">
                {seg.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
