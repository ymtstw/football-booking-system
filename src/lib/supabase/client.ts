/** ブラウザ用 Supabase クライアント（ログイン・パスワード再設定等）。Server では server.ts を使う。 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    // プロジェクトの URL・anon キー（公開してよいキー）。.env.local の NEXT_PUBLIC_* と対応。
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
