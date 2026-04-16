/** 管理の保護ルート共通。getAdminUser 失敗時はログインへ。ヘッダ・ナビ・ログアウト。 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

import { AdminSignOutButton } from "./sign-out-button";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href="/admin/dashboard"
              className="min-h-9 inline-flex items-center font-medium text-zinc-900"
            >
              ダッシュボード
            </Link>
            <Link
              href="/admin/event-days"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              開催日
            </Link>
            <Link
              href="/admin/pre-day-results"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              前日確定
            </Link>
            <Link
              href="/admin/camp-inquiries"
              className="min-h-9 inline-flex items-center text-zinc-600 hover:text-zinc-900"
            >
              合宿相談
            </Link>
          </nav>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
            <span
              className="max-w-full truncate text-xs text-zinc-600 sm:max-w-[min(100%,220px)] sm:text-sm"
              title={user.email ?? ""}
            >
              {user.email}
            </span>
            <AdminSignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-8">
        {children}
      </div>
    </div>
  );
}
