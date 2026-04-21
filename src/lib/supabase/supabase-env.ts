/**
 * Supabase 接続用の環境変数。
 * 新名称（Publishable / Secret）を優先し、移行期間中はレガシー名をフォールバックする。
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL が未設定です。");
  }
  return url;
}

/** ブラウザ・Cookie 連携サーバー用（RLS あり）。 */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（または移行中 NEXT_PUBLIC_SUPABASE_ANON_KEY）が未設定です。"
    );
  }
  return key;
}

/** サーバー専用（RLS バイパス）。クライアントから import しないこと。 */
export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY（または移行中 SUPABASE_SERVICE_ROLE_KEY）が未設定です。"
    );
  }
  return key;
}
