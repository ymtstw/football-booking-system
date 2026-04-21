import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/supabase/supabase-env";

/** 結合テスト用（server-only を経由しない）。 */
export function getIntegrationSupabase(): SupabaseClient {
  let url: string;
  let key: string;
  try {
    url = getSupabaseUrl();
    key = getSupabaseSecretKey();
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY（または移行中 SUPABASE_SERVICE_ROLE_KEY）が未設定です。プロジェクト直下に .env.test を作成し、tests/integration/env.test.example を参照してください。"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SECRET_KEY?.trim() ||
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  );
}
