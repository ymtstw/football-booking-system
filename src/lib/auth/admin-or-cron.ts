import "server-only";

import { type NextRequest } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";

/** Cron 用: 16 文字以上の CRON_SECRET を想定（lock-event-days と同じ）。 */
export function cronSecretForMatching(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return secret;
}

export function authorizeCronBearer(request: NextRequest, secret: string): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** 管理ログイン、または Cron の Bearer と一致すれば true。 */
export async function authorizeAdminOrCron(request: NextRequest): Promise<boolean> {
  if (await getAdminUser()) return true;
  const secret = cronSecretForMatching();
  if (!secret) return false;
  return authorizeCronBearer(request, secret);
}
