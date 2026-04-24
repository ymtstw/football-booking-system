import Link from "next/link";

import type { Metadata } from "next";

import { IconClipboard, IconPencil, IconTent } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
import { CampInquiryForm } from "./inquiry/camp-inquiry-form";

export const metadata: Metadata = {
  title: "合宿のご相談 | 小学生サッカー対戦予約",
  description:
    "合宿のご相談フォームです。予約確定ではなく相談受付です。日程や人数が未定でもお気軽にどうぞ。",
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
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-3 text-[15px] leading-relaxed text-zinc-700 sm:text-base sm:leading-relaxed">
            <p>
              合宿に関するご相談を受け付けるフォームです。交流試合を含めたご希望も、あわせてお知らせください。
            </p>
            <p>
              日程や人数が未定でも問題ありません。まずは分かる範囲でご入力ください。
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-[#fff8e6] px-4 py-4 sm:px-5 sm:py-5">
              <span className="shrink-0 pt-0.5 text-amber-900" aria-hidden>
                <IconClipboard className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.65} />
              </span>
              <div className="min-w-0 space-y-2 text-[15px] leading-relaxed text-amber-950 sm:text-sm sm:leading-relaxed">
                <p className="font-semibold text-amber-900">このフォームについて</p>
                <p>このフォームは予約確定ではなく、ご相談受付用です。</p>
                <p>内容を確認のうえ、運営よりご連絡します。</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-rp-mint-2 bg-rp-mint/60 px-4 py-4 sm:px-5 sm:py-5">
              <span className="shrink-0 pt-0.5 text-rp-brand" aria-hidden>
                <IconPencil className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.65} />
              </span>
              <div className="min-w-0 text-[15px] leading-relaxed text-zinc-800 sm:text-sm sm:leading-relaxed">
                <p className="font-semibold text-rp-brand">入力の目安</p>
                <p className="mt-2">以下の内容が決まっていればご記入ください。</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>ご希望の日程</li>
                  <li>人数やチーム数</li>
                  <li>相談したい内容</li>
                </ul>
              </div>
            </div>
          </div>

          <CampInquiryForm submitLabel="この内容で相談する" />
        </div>
      </div>

      <p className="text-center text-sm text-zinc-600">
        日帰りの交流試合のみのお申し込みは、
        <Link
          href="/"
          className="font-semibold text-rp-brand underline underline-offset-2"
        >
          予約カレンダー
        </Link>
        からお進みください。
      </p>
    </div>
  );
}
