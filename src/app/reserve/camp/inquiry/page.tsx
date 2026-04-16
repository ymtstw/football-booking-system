import Link from "next/link";

import type { Metadata } from "next";

import { CampInquiryForm } from "./camp-inquiry-form";

export const metadata: Metadata = {
  title: "合宿・日程のご相談 | 交流試合",
  description:
    "相談受付〜事前案内まで。宿泊プランと希望日程の目安をお送りいただくフォームです。当日の進行管理は対象外です。",
};

export default function ReserveCampInquiryPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <p className="text-sm">
          <Link
            href="/reserve/camp"
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            ← 合宿のご案内
          </Link>
        </p>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900 sm:text-xl">
          合宿・日程のご相談
        </h1>
        <p className="mt-2 text-xs text-zinc-500 sm:text-sm">
          詳細確定フォームではなく、まず日程・プランのご相談を受け付ける入口です。開催当日の進行や対戦表の作成は本サイトの範囲外です。
        </p>
      </div>

      <CampInquiryForm />
    </div>
  );
}
