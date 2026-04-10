/** サイトトップ。パスワード再設定で # 付きで着いたときだけ AuthHashRedirect が動く。 */
import Link from "next/link";

import { AuthHashRedirect } from "./auth-hash-redirect";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AuthHashRedirect />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          和歌山サッカー交流試合（予約）
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          開催日の申し込み・確認コードによる予約の確認・キャンセルは、下のリンクから行えます。
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/reserve"
            className="rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white"
          >
            開催日一覧・予約
          </Link>
          <Link
            href="/reserve/manage"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium"
          >
            予約の確認・キャンセル
          </Link>
          <Link
            href="/admin/login"
            className="text-center text-sm text-zinc-500 underline"
          >
            管理者ログイン
          </Link>
        </div>
      </main>
    </div>
  );
}
