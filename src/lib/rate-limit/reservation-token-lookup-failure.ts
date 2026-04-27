import "server-only";

import { NextResponse } from "next/server";

import { getClientIpForRateLimit } from "@/lib/rate-limit/client-ip";
import { checkMemorySlidingWindow } from "@/lib/rate-limit/memory-sliding-window";

/** 確認コードの誤入力・不存在が続いたときの同一 IP 抑止 */
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 20;

function tooManyResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "アクセスが集中しています。しばらくしてからお試しください。" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

/**
 * 照会失敗を記録し、閾値超えなら 429。
 * 成功時は呼ばないこと。
 */
export function recordReservationTokenLookupFailure(
  request: Request
): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `res:token:lookup-fail:${ip}`,
    limit: FAIL_LIMIT,
    windowMs: FAIL_WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}
