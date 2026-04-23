/**
 * 管理画面用: Cookie のセッションで app_admins にいるかだけ返す（ログイン直後の確認用）。
 */
import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ ok: false as const }, { status: 403 });
  }
  return NextResponse.json({ ok: true as const });
}
