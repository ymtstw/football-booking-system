"use client";

/** 画面1: 予約トップ（仕様書 4-1〜4-7 + starter HTML） */
import Link from "next/link";

import {
  IconCalendar,
  IconClockDay,
  IconCloudRain,
  IconPitch,
  IconScaleSoft,
  IconSoccerBall,
  IconUtensils,
} from "./_components/reserve-icons";
import { ReserveRasterIcon } from "./_components/reserve-raster-icon";
import { ReserveStepper } from "./_components/reserve-stepper";
import {
  ReserveCallout,
  ReserveHeroPitchCard,
  ReserveInfoCard,
  ReserveInfoGrid,
  ReserveLead,
  ReserveLeadingIcon,
  ReserveMainShell,
  ReservePageTitle,
  ReservePrimaryCtaLink,
  ReserveSectionHeading,
} from "./_components/ui";

export default function ReserveLandingPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <ReserveStepper current={1} />

      <ReserveMainShell>
        <ReservePageTitle
          icon={<IconSoccerBall className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />}
        >
          小学生サッカー対戦予約（日帰り）
        </ReservePageTitle>
        <ReserveLead>
          人工芝グラウンド無料貸し出しイベントの予約ページです。
        </ReserveLead>

        <ReserveInfoGrid>
          <ReserveHeroPitchCard
            feature
            icon={
              <ReserveRasterIcon
                name="extra-18"
                className="relative block h-full min-h-[132px] w-full"
                alt=""
              />
            }
          >
            人工芝グラウンド
            <br />
            無料開放！
          </ReserveHeroPitchCard>
          <ReserveInfoCard
            title="予約対象は人工芝グラウンドのみです"
            icon={<IconPitch className="h-6 w-6 sm:h-6 sm:w-6" strokeWidth={1.65} />}
          >
            <p>
              土グラウンドのご利用も可能ですが、予約対象ではありません。
            </p>
          </ReserveInfoCard>
          <ReserveInfoCard
            title="1日を通した利用が前提です"
            icon={<IconCalendar className="h-6 w-6 sm:h-6 sm:w-6" strokeWidth={1.65} />}
          >
            <p>
              1枠のみ・午前のみ・午後のみの予約は承っていません。午前から1日を通してご利用いただきます。
            </p>
          </ReserveInfoCard>
          <ReserveInfoCard
            title="対戦相手の確定や試合成立を保証するものではありません"
            icon={<IconScaleSoft className="h-6 w-6 sm:h-6 sm:w-6" strokeWidth={1.65} />}
          >
            <p>
              参加チーム数に応じて利用可能な時間および試合数は変動します。
            </p>
          </ReserveInfoCard>
        </ReserveInfoGrid>

        <ReserveCallout
          tone="green"
          className="mt-6 space-y-6 p-6 text-base leading-relaxed text-slate-800 sm:p-8 sm:text-lg"
        >
          <div className="flex gap-3 sm:gap-4">
            <ReserveLeadingIcon
              shell="greenBare"
              icon={<IconClockDay className="h-5 w-5 sm:h-6 sm:w-6" />}
            />
            <div className="min-w-0">
              <p className="font-bold text-slate-900">
                予約締切は原則として開催日の2日前15:00です。
              </p>
              <p className="mt-1">
                当日の試合スケジュールは締切日の16:30に登録メールアドレス宛にお送りします。
              </p>
            </div>
          </div>
          <div className="flex gap-3 border-t border-dashed border-green-300 pt-6 sm:gap-4">
            <ReserveLeadingIcon
              shell="greenBare"
              icon={<IconCloudRain className="h-5 w-5 sm:h-6 sm:w-6" />}
            />
            <div className="min-w-0">
              <p className="font-bold text-slate-900">
                雨天などの悪天候による開催可否は遅くとも前日17:00までにお知らせします。
              </p>
              <p className="mt-1">天気予報次第では中止判断が早まる場合があります。</p>
            </div>
          </div>
        </ReserveCallout>

        <ReserveCallout tone="orange" className="mt-6 p-6 sm:p-8">
          <ReserveSectionHeading
            as="h2"
            tone="orange"
            icon={<IconUtensils className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.65} />}
          >
            昼食について
          </ReserveSectionHeading>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-8 text-slate-800 sm:text-lg">
            <li>ご参加チームには昼食のご注文をお願いしています</li>
            <li>飲食物の持ち込みは禁止です</li>
            <li>昼食を申し込まない場合は当施設のカフェをご利用いただくことも可能です</li>
            <li>昼食代は各チームの代表者がまとめて現地でお支払いください</li>
            <li>アレルギーや食中毒対策等、やむを得ない場合のみ一部持ち込み可能です</li>
          </ul>
        </ReserveCallout>

        <div className="mt-10 flex justify-center">
          <ReservePrimaryCtaLink href="/reserve/calendar">
            開催日を確認する
          </ReservePrimaryCtaLink>
        </div>
      </ReserveMainShell>

      <p className="text-center text-sm text-slate-600">
        合宿・宿泊のご相談は{" "}
        <Link
          href="/reserve/camp"
          className="font-semibold text-green-700 underline underline-offset-2 hover:text-green-800"
        >
          合宿のご相談
        </Link>
        からお送りください。
      </p>
    </div>
  );
}
