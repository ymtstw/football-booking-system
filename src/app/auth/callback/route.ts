/** PKCE コールバック: ?code= をサーバーでセッションに交換し、クッキー付きで next へリダイレクト。 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * /auth/callback?next=/foo の「next」が安全か確認する。
 * http://悪意のあるサイト… のように外部へ飛ばされないよう、相対パスだけ許可。
 */
function safeNextPath(next: string | null): string {
  const fallback = "/auth/update-password";
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

/**
 * メールリンクなどでブラウザに ?code= が付いたとき、サーバー側でその code を
 * 「ログイン済みセッション」に交換し、クッキーに保存する API。
 *
 * 流れの例:
 * 1. ユーザーがメールのリンクを開く → いったんこの URL に来る（proxy から誘導されることもある）
 * 2. exchangeCodeForSession(code) で Supabase と通信
 * 3. 成功したら next（なければパスワード再設定ページ）へリダイレクト（クッキー付き）
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));

  const fail = (reason: string) => {
    const errUrl = new URL("/auth/update-password", url.origin);
    errUrl.searchParams.set("error", reason);
    return NextResponse.redirect(errUrl);
  };

  if (!code) {
    return fail("missing_code");
  }

  // 先に「どこへ飛ばすか」を決めたレスポンスを作り、そこへセッション用クッキーを載せる
  const response = NextResponse.redirect(new URL(nextPath, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail("auth_callback");
  }

  return response;
}
