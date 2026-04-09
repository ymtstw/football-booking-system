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
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/event-days" className="font-medium text-zinc-900">
              開催日
            </Link>
            <Link href="/admin/dashboard" className="text-zinc-600 hover:text-zinc-900">
              ダッシュボード
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span className="truncate max-w-[200px]" title={user.email ?? ""}>
              {user.email}
            </span>
            <AdminSignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
    </div>
  );
}
