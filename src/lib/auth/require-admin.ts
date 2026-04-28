/** ログイン済みかつ app_admins にいるユーザーだけ返す。管理 API・保護レイアウトで使用。 */
import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** 未ログインと「ログイン済みだが app_admins にいない」を区別する（リダイレクト・メッセージ用） */
export type AdminGateResult =
  | { kind: "ok"; user: User }
  | { kind: "no_session" }
  | { kind: "not_allowlisted"; user: User };

/** 同一リクエスト内でレイアウト・各ページの二重チェックをまとめる（Supabase 往復削減） */
export const getAdminGate = cache(async function getAdminGate(): Promise<AdminGateResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { kind: "no_session" };

  const { data: adminRow } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) return { kind: "not_allowlisted", user };
  return { kind: "ok", user };
});

export async function getAdminUser(): Promise<User | null> {
  const gate = await getAdminGate();
  return gate.kind === "ok" ? gate.user : null;
}
