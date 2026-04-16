import Link from "next/link";

import type { Metadata } from "next";

import { getActiveLodgingPlansSorted } from "@/lib/camp-inquiry/camp-lodging-plans";

export const metadata: Metadata = {
  title: "合宿のご案内 | 交流試合",
  description:
    "合宿・宿泊は相談受付と事前案内まで。当日の進行管理や対戦表の作成は対象外です。プラン確認のうえ日程のご相談からお進みください。",
};

/** 合宿案内（プラン一覧・相談フォームへの前段） */
export default function ReserveCampInfoPage() {
  const plans = getActiveLodgingPlansSorted();

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          合宿のご案内
        </h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600">
          <p>
            当サイトでは、<strong className="text-zinc-800">宿泊を伴う交流試合・合宿</strong>
            についてもご相談いただけます。交流試合を含めたご希望や、宿泊中心のご相談も可能です。
          </p>
          <p>
            <strong className="text-zinc-800">参加人数や詳細が未確定でも</strong>
            、まずは希望の日程感とプランの目安からお気軽にご相談ください。お送りいただいた内容を確認のうえ、
            <strong className="text-zinc-800">運営よりご案内</strong>します。
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            この時点では<strong className="font-semibold"> 予約の確定ではありません</strong>
            。空き状況や部屋の厳密な自動突合は行わず、受付後はメール等でのやり取りを想定しています。
          </p>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700">
            <p className="font-medium text-zinc-900">本サイトでお手伝いする範囲（MVP）</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>合宿・宿泊の<strong className="text-zinc-900">相談の受付</strong></li>
              <li>運営が受入可否を判断するための<strong className="text-zinc-900">情報の共有</strong></li>
              <li>開催前までの<strong className="text-zinc-900">事前のご案内</strong>（メール等）</li>
            </ul>
            <p className="mt-2 text-zinc-600">
              開催が決まった<strong className="text-zinc-800">当日</strong>の試合順の細かい調整、チーム間の進行、当日運営の詳細などは、
              <strong className="text-zinc-800">各チーム・現場での対応</strong>を前提としており、本サイトに進行管理・合宿専用の対戦表・当日運営の管理機能はありません。
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          現在ご案内可能な宿泊プラン
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">
          以下は運用の初期案です。プラン名・内容は変更される場合があります。
        </p>
        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            現在、掲載中のプランがありません。お手数ですが「お問い合わせ」からご連絡ください。
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-3 sm:px-4"
              >
                <p className="text-sm font-medium text-zinc-900">{p.titleJa}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {p.summaryJa}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-4 sm:px-5">
        <p className="text-sm font-medium text-sky-950">次のステップ</p>
        <p className="mt-2 text-sm leading-relaxed text-sky-950/95">
          まずは希望日程とプラン、参加予定人数の目安をフォームからお送りください。開催前の調整までを想定し、当日の運用まではシステム化しません。
        </p>
        <div className="mt-4">
          <Link
            href="/reserve/camp/inquiry"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
          >
            この日程で相談する
          </Link>
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        日帰りの交流試合のみのお申し込みは、
        <Link href="/reserve" className="text-zinc-700 underline underline-offset-2">
          予約カレンダー
        </Link>
        からお進みください。
      </p>
    </div>
  );
}
