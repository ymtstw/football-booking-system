import "server-only";

import { NextResponse } from "next/server";

import { getClientIpForRateLimit } from "@/lib/rate-limit/client-ip";
import { checkMemorySlidingWindow } from "@/lib/rate-limit/memory-sliding-window";

const LIMIT = 10;
const WINDOW_MS = 60_000;

function tooManyResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "送信が集中しています。しばらくしてからお試しください。" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

/** 合宿相談 POST: 同一 IP からの連投を抑止 */
export function rateLimitCampInquiryCreate(request: Request): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `camp:inquiry:${ip}`,
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}
