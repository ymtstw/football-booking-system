/** サービスロールで Supabase（RLS バイパス）。管理 API 等サーバー専用。絶対に Client に import しない。 */
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, getSupabaseUrl } from "./supabase-env";

export function createServiceRoleClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
