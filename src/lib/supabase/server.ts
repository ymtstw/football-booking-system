/** サーバー用 Supabase（Cookie 連携）。Server Component / Route Handler から。クライアントでは client.ts。 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component は「読み取りのみ」のことが多く、ここで set すると例外になることがある。その場合は無視（セッション更新は proxy などで行う）
          }
        },
      },
    }
  );
}
