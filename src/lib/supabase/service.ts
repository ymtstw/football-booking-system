import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Route Handler / Server Action などサーバー専用。
 * RLS をバイパスするため、クライアントや Client Component から import しない。
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です（.env.local を確認）"
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
