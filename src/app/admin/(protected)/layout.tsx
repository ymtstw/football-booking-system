/** 管理の保護ルート共通。getAdminGate で未ログインと権限なしを分け、ログインへ。ヘッダ・ナビ・ログアウト。 */
import { redirect } from "next/navigation";

import { getAdminGate } from "@/lib/auth/require-admin";

import { AdminBreadcrumbBar } from "./admin-breadcrumb-bar";
import { AdminProtectedHeader } from "./admin-protected-header";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getAdminGate();
  if (gate.kind === "no_session") {
    redirect("/admin/login");
  }
  if (gate.kind === "not_allowlisted") {
    redirect("/admin/login?forbidden=1");
  }
  const user = gate.user;

  return (
    <div className="min-h-dvh min-h-screen bg-zinc-100/90">
      <AdminProtectedHeader userEmail={user.email ?? ""} />
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-8">
        <AdminBreadcrumbBar />
        {children}
      </div>
    </div>
  );
}
