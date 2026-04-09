/** 管理の公開ルート（ログイン等）。既に管理者なら開催日へリダイレクト。 */
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

export default async function AdminPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getAdminUser()) {
    redirect("/admin/event-days");
  }
  return <>{children}</>;
}
