import Link from "next/link";

import type { Metadata } from "next";

import { IconTent } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
import { CampInquiryForm } from "./inquiry/camp-inquiry-form";

export const metadata: Metadata = {
  title: "合宿のご相談 | 小学生サッカー対戦予約",
  description:
    "合宿に関するご相談フォームです。予約確定ではなくご相談受付。確認後に担当者よりご連絡します。",
};

/** 合宿の相談受付（案内とフォームを1画面） */
export default function ReserveCampConsultPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <ReserveHeadingWithIcon
        as="h1"
        shell="navy"
        icon={<IconTent className="h-6 w-6 sm:h-7 sm:w-7" />}
        textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
      >
        合宿のご相談
      </ReserveHeadingWithIcon>

      <div className="rounded-2xl border-2 border-rp-brand/30 bg-white p-4 shadow-md sm:p-6">
        <CampInquiryForm submitLabel="この内容で相談する" />
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
