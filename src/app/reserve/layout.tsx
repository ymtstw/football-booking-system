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
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/reserve" className="font-semibold text-zinc-900">
            交流試合 予約
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/reserve" className="text-zinc-600 hover:text-zinc-900">
              開催日一覧
            </Link>
            <Link
              href="/reserve/manage"
              className="text-zinc-600 hover:text-zinc-900"
            >
              予約確認・キャンセル
            </Link>
            <Link href="/" className="text-zinc-600 hover:text-zinc-900">
              トップ
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
