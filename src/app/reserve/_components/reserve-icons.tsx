import type { ReactNode, SVGProps } from "react";

/** 線画アイコン（24×24）。サイズは className で指定 */
export type ReserveIconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function base(
  props: ReserveIconProps & { children: ReactNode }
): React.ReactElement {
  const { children, className, strokeWidth = 1.75, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/**
 * サッカーボール（外周＋中央の五角形パネル＋頂点から外周への線）。
 * 緯線経線風にすると地球儀に見えるため、パネル構成を明示する。
 */
export function IconSoccerBall(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: props.strokeWidth ?? 1.75,
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8.5 15.33 10.92 14.06 14.83 9.94 14.83 8.67 10.92z" />
        <path d="M12 8.5 12 3M15.33 10.92 20.57 9.22M14.06 14.83 17.29 19.27M9.94 14.83 6.71 19.27M8.67 10.92 3.43 9.22" />
      </>
    ),
  });
}

export function IconClipboard(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    ),
  });
}

export function IconInfoCircle(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    ),
  });
}

export function IconCalendar(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  });
}

export function IconLock(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  });
}

export function IconPhone(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
  });
}

export function IconHome(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  });
}

export function IconPencil(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </>
    ),
  });
}

export function IconCheck(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: props.strokeWidth ?? 2,
    children: <polyline points="20 6 9 17 4 12" />,
  });
}

/** テント（合宿見出し） */
export function IconTent(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: props.strokeWidth ?? 1.75,
    children: (
      <>
        <path d="M3 20h18" />
        <path d="M12 5 3 20h18L12 5z" />
        <path d="M10 20v-8h4v8" />
      </>
    ),
  });
}

export function IconMenu(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: <path d="M5 7h14M5 12h14M5 17h14" />,
  });
}

export function IconX(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: <path d="M6 6l12 12M18 6 6 18" />,
  });
}

export function IconArrowRight(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
  });
}

export function IconArrowLeft(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M19 12H5" />
        <path d="m12 5-7 7 7 7" />
      </>
    ),
  });
}

export function IconChevronLeft(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: <path d="M14 6l-6 6 6 6" />,
  });
}

export function IconChevronRight(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: <path d="M10 6l6 6-6 6" />,
  });
}

export function IconChevronDown(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: <path d="m6 9 6 6 6-6" />,
  });
}

/** 昼食カード等で使用（マグカップ） */
export function IconCoffee(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
        <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
        <path d="M7 3v2M11 3v2M15 3v2" />
      </>
    ),
  });
}

/** 円マーク（支払い） */
export function IconYen(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 7 4 5 4-5" />
        <path d="M12 12v6" />
        <path d="M8 14h8" />
        <path d="M8 17h8" />
      </>
    ),
  });
}

/** 警告トライアングル（注意喚起） */
export function IconAlertTriangle(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
  });
}

/** 弁当（昼食） */
export function IconLunch(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" ry="2" />
        <path d="M3 12h18" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </>
    ),
  });
}

/** 屋外（人工芝グラウンドの暗喩） */
export function IconPitch(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <circle cx="12" cy="12" r="2" />
        <path d="M2 9h3v6H2zM19 9h3v6h-3z" />
      </>
    ),
  });
}

/** 時計（時間関連） */
export function IconClock(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </>
    ),
  });
}

/** 握手（対戦成立の暗喩） */
export function IconHandshake(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M11 17 9 19a2 2 0 0 1-2.83 0l-2.34-2.34a2 2 0 0 1 0-2.83L11 7" />
        <path d="m13 17 2 2a2 2 0 0 0 2.83 0l2.34-2.34a2 2 0 0 0 0-2.83L13 7" />
        <path d="M8 8l4-4 4 4" />
      </>
    ),
  });
}

/** 雲＆雨（悪天候） */
export function IconCloudRain(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M17 18a4 4 0 0 0 0-8 5 5 0 0 0-9.9-1A4.5 4.5 0 0 0 6.5 18" />
        <line x1="8" y1="20" x2="8" y2="22" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="16" y1="20" x2="16" y2="22" />
      </>
    ),
  });
}
