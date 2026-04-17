import type { ReactNode, SVGProps } from "react";

import {
  ReserveRasterIcon,
  type ReserveRasterName,
} from "./reserve-raster-icon";

/** 線画アイコン用（ナビ・矢印など細い UI） */
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

const SVG_ONLY_ATTRS = new Set([
  "strokeWidth",
  "stroke",
  "fill",
  "viewBox",
  "xmlns",
  "d",
  "cx",
  "cy",
  "r",
  "x",
  "y",
  "width",
  "height",
  "children",
  "pathLength",
  "points",
]);

function raster(
  name: ReserveRasterName,
  props: ReserveIconProps
): React.ReactElement {
  const { className, ...raw } = props;
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!SVG_ONLY_ATTRS.has(k) && v !== undefined) {
      rest[k] = v;
    }
  }
  return (
    <ReserveRasterIcon
      {...(rest as Omit<
        React.ComponentProps<typeof ReserveRasterIcon>,
        "name" | "className"
      >)}
      className={className}
      name={name}
    />
  );
}

/** 生成アセット（soccer-ball.png） */
export function IconSoccerBall(props: ReserveIconProps) {
  return raster("soccer-ball", props);
}

export function IconClipboard(props: ReserveIconProps) {
  return raster("clipboard-info", props);
}

export function IconInfoCircle(props: ReserveIconProps) {
  return raster("info-circle", props);
}

export function IconCalendar(props: ReserveIconProps) {
  return raster("calendar", props);
}

export function IconCloudRain(props: ReserveIconProps) {
  return raster("cloud-rain", props);
}

export function IconUtensils(props: ReserveIconProps) {
  return raster("lunch", props);
}

/** ピッチ・施設イメージ */
export function IconPitch(props: ReserveIconProps) {
  return raster("calendar-soccer", props);
}

/** 締切・スケジュール系（カレンダー＋ボールの予定感／extra-18 はヒーロー訴求用に使用中） */
export function IconClockDay(props: ReserveIconProps) {
  return raster("extra-17", props);
}

export function IconScaleSoft(props: ReserveIconProps) {
  return raster("handshake", props);
}

/** 午前枠（太陽。バナー PNG はトップヒーロー専用のため線画 SVG） */
export function IconSunMorning(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: props.strokeWidth ?? 1.75,
    children: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </>
    ),
  });
}

export function IconLock(props: ReserveIconProps) {
  return raster("lock", props);
}

/** お問い合わせ・電話（透明抜きラスタ。ファイル名は envelope のまま） */
export function IconPhone(props: ReserveIconProps) {
  return raster("envelope", props);
}

/** 合宿・施設（透明抜き建物ラスタ） */
export function IconHome(props: ReserveIconProps) {
  return raster("building", props);
}

export function IconSearch(props: ReserveIconProps) {
  return raster("search", props);
}

export function IconPencil(props: ReserveIconProps) {
  return raster("documents", props);
}

export function IconTrash(props: ReserveIconProps) {
  return raster("warning", props);
}

export function IconCheck(props: ReserveIconProps) {
  return raster("check-square", props);
}

/** テント（合宿見出し。extra-17 は締切行のカレンダー合成アイコンに使用中のため SVG） */
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

export function IconCopy(props: ReserveIconProps) {
  return raster("documents", props);
}

/* --- 細線 UI（SVG のまま。サイズは className でレスポンシブ） --- */

export function IconMenu(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: (
      <>
        <path d="M5 7h14M5 12h14M5 17h14" />
      </>
    ),
  });
}

export function IconX(props: ReserveIconProps) {
  return base({
    ...props,
    strokeWidth: 2,
    children: (
      <>
        <path d="M6 6l12 12M18 6 6 18" />
      </>
    ),
  });
}

export function IconArrowRight(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M5 12h12M13 7l6 5-6 5" />
      </>
    ),
  });
}

export function IconArrowLeft(props: ReserveIconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M19 12H7M11 7l-6 5 6 5" />
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
