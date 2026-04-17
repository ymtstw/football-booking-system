"use client";

import Image from "next/image";
import type { HTMLAttributes } from "react";

/** `public/reserve-icons-generated/` 配下のファイル名（拡張子なし） */
export type ReserveRasterName =
  | "soccer-ball"
  | "envelope"
  | "search"
  | "handshake"
  | "cloud-rain"
  | "clipboard-info"
  | "info-circle"
  | "building"
  | "lock"
  | "check-square"
  | "calendar"
  | "calendar-soccer"
  | "documents"
  | "warning"
  | "lunch"
  | "briefcase"
  | "extra-17"
  | "extra-18";

const PREFIX = "/reserve-icons-generated";

/**
 * 生成 PNG 用。親の `className` で `h-6 w-6 sm:h-8 sm:w-8` などサイズを必ず指定してください。
 * `object-contain` で縦横比を維持します。
 */
export function ReserveRasterIcon({
  name,
  className = "",
  alt = "",
  ...rest
}: Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: ReserveRasterName;
  alt?: string;
}) {
  const src = `${PREFIX}/${name}.png`;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      aria-hidden={alt === "" ? true : undefined}
      {...rest}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 24px, 32px"
        className="pointer-events-none select-none object-contain"
        loading="lazy"
        draggable={false}
      />
    </span>
  );
}
