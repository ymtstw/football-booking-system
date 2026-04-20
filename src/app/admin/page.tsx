/** /admin: 管理者なら運営起点（ダッシュ）へ、未ログイン・非管理者はログインへ。 */
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

export default async function AdminIndexPage() {
  if (await getAdminUser()) {
    redirect("/admin/dashboard");
  }
  redirect("/admin/login");
}
