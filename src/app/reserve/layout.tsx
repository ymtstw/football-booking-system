import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "予約 | 交流試合",
  description: "開催日の申し込み・確認コードでの予約確認・キャンセル",
};

export default function ReserveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Link
            href="/reserve"
            className="shrink-0 text-base font-semibold text-zinc-900 sm:text-[15px]"
          >
            交流試合 予約
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm sm:gap-x-4 sm:justify-end">
            <Link
              href="/reserve"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              予約カレンダー
            </Link>
            <Link
              href="/reserve/manage"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              予約確認・キャンセル
            </Link>
            <Link
              href="/reserve/contact"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              お問い合わせ
            </Link>
            <Link
              href="/"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              トップ
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 pb-10 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}
