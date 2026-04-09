/** Next.js 16 Proxy: 認証まわりのリダイレクト ＋ 全リクエストで Supabase セッション（Cookie）更新。 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";

  // --- パスワード再設定まわりのリダイレクト（このブロックのあとに通常処理）---

  // Supabase の「Site URL」が http://localhost:3000 だけだと、メール後の着地点が
  // http://localhost:3000/?code=... になりがち。トップのままではコード交換しにくいので
  // /auth/callback へ回す（?code= はクエリなのでサーバーが見える）。
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // 別表記・手打ち用 URL を、実際の再設定画面に統一する
  if (
    pathname === "/resetpassword" ||
    pathname === "/reset-password"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/update-password";
    return NextResponse.redirect(url);
  }

  // --- 以降: すべてのリクエストで Supabase のセッション（クッキー）を読み、必要なら更新 ---

  const supabaseResponse = NextResponse.next({
    request,
  });

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
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      }
    }
  );

  // 期限切れに近いセッションのリフレッシュなどに使う（@supabase/ssr の定番パターン）
  await supabase.auth.getUser();

  return supabaseResponse;
}

/** 静的ファイルなど、proxy を通さないパス（正規表現） */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
