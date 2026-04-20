"use client";

/**
 * サイトルート `/` 用:
 * Supabase の #access_token 等はサーバーに届かないため、/auth/update-password に hash ごと付け替える。
 * それ以外はイベント案内を表示する。
 */
import { useLayoutEffect } from "react";

import ReserveEventGuidePage from "./reserve/event-guide-page";

export function HomeReserveRoot() {
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
      }
    }
  }, []);

  return <ReserveEventGuidePage />;
}
