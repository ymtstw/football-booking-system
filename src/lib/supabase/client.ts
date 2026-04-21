/** ブラウザ用 Supabase クライアント（ログイン・パスワード再設定等）。Server では server.ts を使う。 */
import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./supabase-env";

export function createClient() {
  return createBrowserClient(
    // プロジェクトの URL・Publishable キー（公開してよいキー）。supabase-env でレガシー名もフォールバック。
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      auth: {
        // PKCE: メールの「再設定」リンクなどで ?code= の一回限りコードが返る流れを使う。
        // 付けないと #access_token 形式（implicit）になりやすく、サーバー側と相性が悪い。
        flowType: "pkce",
        // 今開いているページの URL に code などが付いていれば、自動でセッションに取り込む。
        detectSessionInUrl: true,
      },
    }
  );
}
