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
} from "./_components/reserve-icons";
import {
  ReserveInfoCard,
  ReserveInfoGrid,
  ReserveMainShell,
} from "./_components/ui";

export default function ReserveEventGuidePage() {
  return (
    <div className="space-y-4 pb-24 sm:space-y-8 md:pb-0">
      <ReserveMainShell className="overflow-hidden">
        {/* 1. タイトル・概要 */}
        <section>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            <IconSoccerBall className="h-3.5 w-3.5" strokeWidth={2} />
            人工芝グラウンド無料利用
          </span>
          <h1 className="mt-3 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl md:text-[2rem] md:leading-tight">
            小学生サッカー対戦予約
          </h1>
          <p className="mt-3 text-[15px] font-normal leading-relaxed text-slate-700 sm:text-base sm:leading-loose">
            小学生チーム向けの交流試合イベントです。
          </p>
          <p className="mt-2 text-[15px] font-normal leading-relaxed text-slate-700 sm:text-base sm:leading-loose">
            人工芝グラウンドを無料で、午前から午後までご利用いただけます。
          </p>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-700 sm:text-base">
            ご予約前に、参加条件・昼食の利用方法・ご案内の流れをご確認ください。
          </p>
        </section>

        {/* 2. このイベントについて */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-base font-bold leading-snug text-slate-900">このイベントについて</h2>
          <ReserveInfoGrid>
            <ReserveInfoCard title="ご利用いただくグラウンド" icon={<IconPitch className="h-4 w-4 sm:h-6 sm:w-6" />}>
              <p>
                <strong className="font-semibold text-slate-800">予約の対象は人工芝グラウンドです。</strong>
              </p>
              <p className="mt-1.5 sm:mt-2">土グラウンドもありますが、予約枠には含まれません。</p>
              <p className="mt-1.5 sm:mt-2">
                当日は空き状況に応じて、参加チーム同士で譲り合ってご利用ください。
              </p>
            </ReserveInfoCard>
            <ReserveInfoCard title="終日参加のイベントです" icon={<IconClock className="h-4 w-4 sm:h-6 sm:w-6" />}>
              <p>このイベントは、午前から午後までご参加いただく形式です。</p>
              <p className="mt-1.5 sm:mt-2">
                <strong>午前のみ・午後のみのご予約はできません。</strong>
              </p>
            </ReserveInfoCard>
            <ReserveInfoCard
              title="試合の組み方"
              icon={<IconHandshake className="h-4 w-4 sm:h-6 sm:w-6" />}
            >
              <p>ご予約時に、午前の希望枠を1つお選びください。</p>
              <p className="mt-1.5 sm:mt-2">
                対戦相手や午後の試合は、参加チーム数や登録内容をもとに運営が調整します。
              </p>
              <p className="mt-1.5 sm:mt-2">
                各チーム、午前・午後それぞれ1枠以上の対戦を予定しています。
              </p>
              <p className="mt-1.5 sm:mt-2">
                参加チーム数に応じて、対戦枠が増える場合があります。
              </p>
            </ReserveInfoCard>
            <ReserveInfoCard title="開催判断について" icon={<IconCloudRain className="h-4 w-4 sm:h-6 sm:w-6" />}>
              <p>雨天やグラウンド状況により、中止となる場合があります。</p>
              <p className="mt-1.5 sm:mt-2">
                開催可否の最終案内は、前日17:30頃までにメールでご案内します。
              </p>
            </ReserveInfoCard>
          </ReserveInfoGrid>
        </section>

        {/* 3. 昼食について */}
        <LunchCard />

        {/* 4. 申込締切とご案内（常時表示・昼食の次） */}
        <section className="mt-8 sm:mt-10" aria-labelledby="deadline-guide-heading">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
            <h2
              id="deadline-guide-heading"
              className="flex items-center gap-2.5 text-base font-bold leading-snug text-amber-950"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"
                aria-hidden
              >
                <IconAlertTriangle className="h-4 w-4" strokeWidth={2} />
              </span>
              申込締切とご案内の流れ
            </h2>
            <div className="mt-3.5 space-y-2.5 text-[15px] font-normal leading-relaxed text-amber-950/95 sm:leading-relaxed">
              <div className="space-y-3">
                <div>
                  <p className="font-bold">ご予約の締切</p>
                  <p className="mt-1">申込締切は、開催日の2日前 15:00です。</p>
                  <p className="mt-1.5">その時点で2チーム以下の場合は中止となります。</p>
                </div>
                <div>
                  <p className="font-bold">開催予定・試合予定のご案内</p>
                  <p className="mt-1">
                    開催日の2日前 17:30頃までに、開催予定と試合予定をメールでご案内します。
                  </p>
                </div>
                <div>
                  <p className="font-bold">最終開催判断のご案内</p>
                  <p className="mt-1">
                    開催日前日 17:30頃までに、最終的な開催可否をメールでご案内します。
                  </p>
                  <p className="mt-1.5">
                    悪天候などにより安全な実施が難しい場合は、中止となります。
                  </p>
                </div>
                <div>
                  <p className="font-bold">ご案内方法</p>
                  <p className="mt-1">
                    上記のご案内は、ご登録のメールアドレス宛に順次お送りします。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. 予約ルール・注意事項（常時表示） */}
        <section className="mt-8 sm:mt-10" aria-labelledby="reserve-rules-heading">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5 shadow-sm sm:p-6">
            <h2
              id="reserve-rules-heading"
              className="flex items-center gap-2.5 text-base font-bold leading-snug text-slate-900"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200/60 text-slate-600"
                aria-hidden
              >
                <IconClipboard className="h-4 w-4" strokeWidth={2} />
              </span>
              予約ルール・注意事項
            </h2>
            <div className="mt-3.5 space-y-2.5 text-[15px] font-normal leading-relaxed text-slate-700 sm:leading-relaxed">
              <p>予約内容の変更・キャンセルは、開催日の2日前15:00まで可能です。</p>
              <p>締切後の変更・キャンセル、無断キャンセルはご遠慮ください。</p>
              <p>
                当日の試合順・対戦相手・利用時間は、参加チーム同士で相談のうえ、自由に調整していただけます。
              </p>
              <p>メールの到着時刻は前後する場合があります。</p>
              <p>また、悪天候が見込まれる場合は早めに中止をご案内することがあります。</p>
            </div>
          </div>
        </section>

        {/* 6. 合宿のご相談 */}
        <div className="mt-8 sm:mt-10">
          <DetailsBlock icon={<IconTent className="h-4 w-4" />} title="合宿のご相談">
            <p>合宿のご希望は、専用フォームからお問い合わせください。</p>
            <Link
              href="/reserve/camp"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-green-700 underline underline-offset-2 hover:text-green-800"
            >
              合宿のご相談へ
              <IconArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </DetailsBlock>
        </div>

        {/* 7. 予約ボタンエリア */}
        <section className="mt-8 sm:mt-10" aria-label="予約手続き">
          <div className="rounded-2xl border-2 border-green-600/25 bg-green-50/80 p-5 sm:p-6">
            <p className="text-center text-[15px] font-bold leading-snug text-green-900 sm:text-base">
              内容をご確認のうえ、開催日を選んで予約に進んでください。
            </p>
            <Link
              href="/reserve/calendar"
              className="mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-green-600 px-8 text-base font-bold text-white shadow-md transition-colors hover:bg-green-700 sm:min-h-14 sm:text-lg"
            >
              <IconCalendar className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2} />
              予約手続きへ
              <IconArrowRight className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2.5} />
            </Link>
            <p className="mt-2.5 text-center text-[13px] font-medium leading-relaxed text-green-900/85 sm:text-[15px]">
              カレンダーから空きのある開催日を選び、入力・確認のあと予約完了となります。
            </p>
          </div>
        </section>
      </ReserveMainShell>

      <MobileStickyCta />
    </div>
  );
}

/** 昼食について（目立つカード） */
function LunchCard() {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-green-200/70 bg-gradient-to-b from-green-50/50 to-white sm:mt-10">
      <header className="border-b border-green-200/50 bg-white/85 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <span
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-200/80 bg-green-50 text-green-700 sm:flex"
            aria-hidden
          >
            <IconLunch className="h-6 w-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-green-950 sm:text-xl sm:leading-snug">
              昼食の利用方法
            </h2>
            <div className="mt-4 space-y-3 text-[15px] font-normal leading-relaxed text-slate-600 sm:mt-5 sm:text-base sm:leading-relaxed">
              <p>
                <span className="font-semibold text-green-800">「予約時に申し込む」</span>
                または
                <span className="font-semibold text-green-800">「当日施設カフェを利用する」</span>
                の2つの方法があります。
              </p>
              <p>選手分は事前申込、保護者の方は施設カフェの利用がおすすめです。</p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-5 sm:space-y-3.5 sm:p-6">
        <LunchItem tone="green" icon={<IconCheck className="h-4 w-4" strokeWidth={3} />} title="予約時に昼食を申し込む">
          <p>昼食をご希望の場合は、予約時に必要数をご入力ください。</p>
          <p className="mt-2">
            昼食代は、代表者さまがチームごとにまとめて当日現地でお支払いください。
          </p>
        </LunchItem>
        <LunchItem tone="blue" icon={<IconCoffee className="h-4 w-4" />} title="当日施設カフェを利用する">
          <p>
            保護者の方などは、
            <strong className="font-bold text-slate-800">当日施設カフェを直接ご利用</strong>
            いただけます。
          </p>
          <p className="mt-2">
            予約時の昼食数には含めず、当日各自でご利用ください。
          </p>
        </LunchItem>
        <LunchItem tone="rose" icon={<IconX className="h-4 w-4" strokeWidth={3} />} title="食べ物の持ち込みについて">
          <p>昼食を含む食べ物の持ち込みは原則ご遠慮ください。</p>
          <p className="mt-1.5">
            ただし、アレルギーなどやむを得ない事情がある場合は、事前のご申告のうえ持ち込み可能です。
          </p>
          <p className="mt-1.5">飲み物や補食類は持ち込みいただけます。</p>
        </LunchItem>
      </div>
    </section>
  );
}

const lunchToneClass: Record<"green" | "rose" | "blue" | "amber", string> = {
  green: "bg-green-100/90 text-green-700",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-800",
};

function LunchItem({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof lunchToneClass;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200/90 bg-white/95 p-4 sm:flex-row sm:items-start sm:gap-3 sm:p-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:mt-0.5 ${lunchToneClass[tone]}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-slate-700">
        <p className="font-bold leading-snug text-slate-900">{title}</p>
        {children ? (
          <div className="mt-2.5 space-y-2 text-[15px] font-normal leading-relaxed text-slate-600">
            {children}
          </div>
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
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 sm:py-4">
        <span className="flex items-center gap-2.5 text-base font-bold leading-snug text-slate-900">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            aria-hidden
          >
            {icon}
          </span>
          {title}
        </span>
        <IconChevronDown
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <div className="space-y-2 border-t border-slate-100 px-5 pb-4 pt-3 text-[15px] font-normal leading-relaxed text-slate-700">
        {children}
      </div>
    </details>
  );
}

/** スマホ用スティッキー CTA（md 以上では非表示） */
function MobileStickyCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="pointer-events-auto border-t border-slate-200 bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur">
        <Link
          href="/reserve/calendar"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-green-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98]"
        >
          <IconCalendar className="h-4 w-4 shrink-0" strokeWidth={2} />
          予約手続きへ
          <IconArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
