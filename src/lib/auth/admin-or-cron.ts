import "server-only";

import { type NextRequest } from "next/server";

import { getAdminUser } from "@/lib/auth/require-admin";
import { cronSecretConfigured } from "@/lib/cron/cron-auth";

/** Cron 用: 16 文字以上の CRON_SECRET（lock / matching / 通知 Cron と共通）。 */
export function cronSecretForMatching(): string | null {
  return cronSecretConfigured();
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
