"use client";

/**
 * トップ（/）専用:
 * - Supabase の #access_token 等はサーバーに届かないため、/auth/update-password に hash ごと付け替える。
 * - それ以外の通常アクセスは予約導線（/reserve）へ寄せる（ルートのポータルは置かない）。
 */
import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthHashRedirect() {
  const router = useRouter();

  useLayoutEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const params = new URLSearchParams(hash.slice(1));
      const looksLikeSupabaseAuth =
        params.has("access_token") ||
        params.has("error") ||
        params.get("type") === "recovery";
      if (looksLikeSupabaseAuth) {
        window.location.replace(
          `${window.location.origin}/auth/update-password${hash}`
        );
        return;
      }
    }
    router.replace("/reserve");
  }, [router]);

  return null;
}
