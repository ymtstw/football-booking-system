"use client";

/** トップ（/）専用: #access_token 等をサーバーが見えない問題のため、/auth/update-password に hash ごと付け替える。 */
import { useLayoutEffect } from "react";

export function AuthHashRedirect() {
  useLayoutEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    // # を除いた ? と同じ形式で key=value を解析
    const params = new URLSearchParams(hash.slice(1));
    const looksLikeSupabaseAuth =
      params.has("access_token") ||
      params.has("error") ||
      params.get("type") === "recovery";
    if (!looksLikeSupabaseAuth) return;

    // router.push だと # が落ちることがあるので、フル URL で置き換え
    window.location.replace(
      `${window.location.origin}/auth/update-password${hash}`
    );
  }, []);
  return null;
}
