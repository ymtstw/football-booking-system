/** ブラウザのみ: 再設定メール用 redirectTo（/auth/callback）のフル URL。本番は NEXT_PUBLIC_SITE_URL を実 URL に。 */
export function passwordRecoveryRedirectTo(): string {
  if (typeof window === "undefined") {
    throw new Error("passwordRecoveryRedirectTo is browser-only");
  }
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    window.location.origin;
  return `${origin}/auth/callback`;
}
