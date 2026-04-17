import Link from "next/link";

import type { Metadata } from "next";

import { IconClipboard, IconPencil, IconTent } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
import { CampInquiryForm } from "./inquiry/camp-inquiry-form";

export const metadata: Metadata = {
  title: "合宿のご相談 | 小学生サッカー対戦予約",
  description:
    "宿泊を伴う合宿のご相談を受け付けています。予約確定ではなく、まずはお問い合わせください。",
};

/** 合宿の相談受付（案内とフォームを1画面） */
export default function ReserveCampConsultPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <ReserveHeadingWithIcon
        as="h1"
        shell="navy"
        icon={<IconTent className="h-6 w-6 sm:h-7 sm:w-7" />}
        textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
      >
        合宿のご相談
      </ReserveHeadingWithIcon>

      <div className="rounded-2xl border-2 border-rp-brand/30 bg-white p-5 shadow-md sm:p-8">
        <div className="space-y-6">
          <div className="space-y-3 text-sm leading-relaxed text-zinc-700 sm:text-base">
            <p>
              本施設では、<strong className="text-rp-navy">宿泊を伴う合宿</strong>
              のご相談も承っております。
              交流試合を含めたご希望や、宿泊中心のご相談も可能です。
            </p>
            <p>
              ご希望の日程や内容にあわせてご案内いたしますので、まずはお気軽にお問い合わせください。
              人数や詳細が未定の場合でも問題ございません。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-[#fff8e6] px-4 py-4 text-sm leading-relaxed text-amber-950">
              <span className="shrink-0 pt-0.5 text-amber-900" aria-hidden>
                <IconClipboard className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.65} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">ご注意</p>
                <p className="mt-2">
                  ※ このフォームは<strong>予約確定ではなく</strong>
                  、ご相談受付用です。
                </p>
                <p className="mt-2">
                  内容を確認のうえ、運営よりご連絡いたします。
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-rp-mint-2 bg-rp-mint/60 px-4 py-4 text-sm leading-relaxed text-zinc-800">
              <span className="shrink-0 pt-0.5 text-rp-brand" aria-hidden>
                <IconPencil className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.65} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-rp-brand">ご入力について</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>ご連絡先と希望の日程・ご相談内容をお知らせください。</li>
                  <li>人数や詳細が未確定でもご相談いただけます。</li>
                  <li>
                    参加予定人数・チーム数・泊数・希望日は、ご相談内容にご記載ください。
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <CampInquiryForm />
        </div>
      </div>

      <p className="text-center text-sm text-zinc-600">
        日帰りの交流試合のみのお申し込みは、
        <Link
          href="/reserve"
          className="font-semibold text-rp-brand underline underline-offset-2"
        >
          予約カレンダー
        </Link>
        からお進みください。
      </p>
    </div>
  );
}
