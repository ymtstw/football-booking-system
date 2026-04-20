"use client";

/**
 * イベント案内（予約手続きとは別）。表示は主にサイトルート `/`。
 * 予約は /reserve/calendar から開始する。
 */
import Link from "next/link";
import type { ReactNode } from "react";

import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconClock,
  IconCloudRain,
  IconCoffee,
  IconHandshake,
  IconLunch,
  IconPitch,
  IconSoccerBall,
  IconTent,
  IconX,
  IconYen,
} from "./_components/reserve-icons";
import {
  ReserveInfoCard,
  ReserveInfoGrid,
  ReserveMainShell,
} from "./_components/ui";

export default function ReserveEventGuidePage() {
  return (
    <div className="space-y-4 sm:space-y-8">
      <ReserveMainShell className="overflow-hidden">
        {/* 案内ヒーロー（予約ステッパーは付けない） */}
        <section>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
            <IconSoccerBall className="h-3.5 w-3.5" strokeWidth={2} />
            人工芝グラウンド 無料開放
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-green-700 sm:text-sm">
            参加前にお読みください
          </p>
          <h1 className="mt-1 text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl md:text-[2rem] md:leading-tight">
            小学生サッカー対戦イベントのご案内
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">
            日帰りの交流試合です。参加条件・昼食・注意事項をこちらでご確認のうえ、別ページから予約手続きにお進みください。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
            人工芝グラウンドを無料で貸し出す企画です。1日を通してのご利用を前提としています。
          </p>

          {/* 予約締切の amber バナー */}
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 sm:p-4">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              aria-hidden
            >
              <IconAlertTriangle className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 text-sm leading-relaxed sm:text-[15px]">
              <p className="font-bold text-amber-900">
                予約締切: 開催日の2日前 15:00
                <span className="ml-2 font-normal text-amber-800 sm:inline">
                  ／ 悪天候判断: 前日 17:00 まで
                </span>
              </p>
              <p className="mt-0.5 text-xs text-amber-800 sm:text-sm">
                当日の試合スケジュールは締切日 16:30 に登録メール宛へお送りします。
              </p>
            </div>
          </div>
        </section>

        {/* 情報カード 2×2（スマホ）/ 4列（md以上） */}
        <section className="mt-7 sm:mt-8">
          <h2 className="mb-3 text-sm font-bold text-slate-800 sm:text-base">
            このイベントについて
          </h2>
          <ReserveInfoGrid>
            <ReserveInfoCard
              title="人工芝のみ対象"
              icon={<IconPitch className="h-5 w-5 sm:h-6 sm:w-6" />}
            >
              土グラウンドの利用は可能ですが、本予約の対象ではありません。
            </ReserveInfoCard>
            <ReserveInfoCard
              title="1日通し利用"
              icon={<IconClock className="h-5 w-5 sm:h-6 sm:w-6" />}
            >
              午前のみ・午後のみの予約は承っていません。
            </ReserveInfoCard>
            <ReserveInfoCard
              title="対戦成立は保証外"
              icon={<IconHandshake className="h-5 w-5 sm:h-6 sm:w-6" />}
            >
              参加チーム数に応じて利用時間と試合数が変動します。
            </ReserveInfoCard>
            <ReserveInfoCard
              title="悪天候の判断"
              icon={<IconCloudRain className="h-5 w-5 sm:h-6 sm:w-6" />}
            >
              前日17:00までに開催可否をご連絡します。
            </ReserveInfoCard>
          </ReserveInfoGrid>
        </section>

        {/* 昼食について（常時表示・目立つカード） */}
        <LunchCard />

        {/* 詳細（アコーディオン） */}
        <div className="mt-5 space-y-2.5">
          <DetailsBlock
            icon={<IconClipboard className="h-4 w-4" />}
            title="予約ルール・注意事項"
          >
            <p>
              予約締切は原則として開催日の2日前15:00です。当日の試合スケジュールは締切日の16:30に登録メールアドレス宛にお送りします。
            </p>
            <p>
              雨天などの悪天候による開催可否は遅くとも前日17:00までにお知らせします。天気予報次第では中止判断が早まる場合があります。
            </p>
          </DetailsBlock>
          <DetailsBlock
            icon={<IconTent className="h-4 w-4" />}
            title="合宿・宿泊のご相談"
          >
            <p>宿泊を伴う合宿のご希望は、専用フォームからお問い合わせください。</p>
            <Link
              href="/reserve/camp"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-green-700 underline underline-offset-2 hover:text-green-800"
            >
              合宿のご相談へ
              <IconArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </DetailsBlock>
        </div>

        {/* 案内を読んだあとの予約導線（上部の重複 CTA は置かない） */}
        <section className="mt-8" aria-label="予約手続き">
          <div className="rounded-2xl border-2 border-green-600/25 bg-green-50/80 p-4 sm:p-5">
            <p className="text-center text-sm font-bold text-green-900 sm:text-base">
              内容を確認できたら、開催日を選んで予約を始められます
            </p>
            <Link
              href="/reserve/calendar"
              className="mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-green-600 px-8 text-base font-bold text-white shadow-md transition-colors hover:bg-green-700 sm:min-h-14 sm:text-lg"
            >
              <IconCalendar className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2} />
              予約手続きへ（開催日を選ぶ）
              <IconArrowRight className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2.5} />
            </Link>
            <p className="mt-2 text-center text-xs text-green-800/90 sm:text-sm">
              カレンダーから空きのある開催日を選び、入力・確認のあと完了となります。
            </p>
          </div>
        </section>
      </ReserveMainShell>

      {/* モバイル用スティッキー CTA */}
      <MobileStickyCta />
    </div>
  );
}

/** 視認性重視の昼食カード（○×☕¥ アイコンで可否をひと目で判別） */
function LunchCard() {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-amber-50">
      <header className="flex items-center justify-between gap-2 border-b border-orange-200 bg-orange-100/70 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-600 sm:h-10 sm:w-10"
            aria-hidden
          >
            <IconLunch className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-orange-900 sm:text-base">
              昼食について
            </h2>
            <p className="text-[11px] leading-snug text-orange-700 sm:text-xs">
              ご参加前に必ずご確認ください
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white sm:px-2.5 sm:py-1">
          要確認
        </span>
      </header>

      <div className="space-y-2 p-3 sm:p-4">
        <LunchItem
          tone="green"
          icon={<IconCheck className="h-4 w-4" strokeWidth={3} />}
          title="昼食のご注文をお願いしています"
          note="ご参加チームは全員対象です"
        />
        <LunchItem
          tone="rose"
          icon={<IconX className="h-4 w-4" strokeWidth={3} />}
          title="飲食物の持ち込みは禁止"
          note="※アレルギー対策等、やむを得ない場合のみ一部持込可"
        />
        <LunchItem
          tone="blue"
          icon={<IconCoffee className="h-4 w-4" />}
          title="申し込まない場合は施設カフェ利用可"
          note="昼食なしでの参加も可能です"
        />
        <LunchItem
          tone="amber"
          icon={<IconYen className="h-4 w-4" />}
          title="代表者がまとめて現地で支払い"
          note="事前決済は不要です"
        />
      </div>
    </section>
  );
}

const lunchToneClass: Record<"green" | "rose" | "blue" | "amber", string> = {
  green: "bg-green-100 text-green-700",
  rose: "bg-rose-100 text-rose-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
};

function LunchItem({
  tone,
  icon,
  title,
  note,
}: {
  tone: keyof typeof lunchToneClass;
  icon: ReactNode;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-orange-100 bg-white p-2.5 sm:gap-3 sm:p-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-7 sm:w-7 ${lunchToneClass[tone]}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 text-[13px] leading-snug sm:text-sm">
        <p className="font-bold text-slate-900">{title}</p>
        {note ? (
          <p className="mt-0.5 text-[11px] text-slate-600 sm:text-xs">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 折りたたみブロック（<details> ベース） */
function DetailsBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            aria-hidden
          >
            {icon}
          </span>
          {title}
        </span>
        <IconChevronDown
          className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <div className="space-y-2 px-5 pb-4 pt-1 text-xs leading-relaxed text-slate-700 sm:text-sm sm:leading-6">
        {children}
      </div>
    </details>
  );
}

/** スマホ用スティッキー CTA（md 以上では非表示） */
function MobileStickyCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="pointer-events-auto border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <Link
          href="/reserve/calendar"
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-green-600 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98]"
        >
          <IconCalendar className="h-5 w-5" strokeWidth={2} />
          予約手続きへ
          <IconArrowRight className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
