import { type NextRequest } from "next/server";

/** Vercel Cron 等で共有。16 文字未満は無効扱い（lock / matching / 通知 Cron と揃える）。 */
export function cronSecretConfigured(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return null;
  }
  return secret;
}

export function authorizeCronBearer(request: NextRequest, secret: string): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
