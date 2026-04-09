/** /admin: 管理者なら開催日へ、未ログイン・非管理者はログインへ振り分ける。 */
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

export default async function AdminIndexPage() {
  if (await getAdminUser()) {
    redirect("/admin/event-days");
  }
  redirect("/admin/login");
}
