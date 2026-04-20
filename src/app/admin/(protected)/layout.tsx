/** 管理の保護ルート共通。getAdminUser 失敗時はログインへ。ヘッダ・ナビ・ログアウト。 */
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

import { AdminProtectedHeader } from "./admin-protected-header";

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
    <div className="min-h-dvh min-h-screen bg-zinc-100/90">
      <AdminProtectedHeader userEmail={user.email ?? ""} />
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-8">
        {children}
      </div>
    </div>
  );
}
