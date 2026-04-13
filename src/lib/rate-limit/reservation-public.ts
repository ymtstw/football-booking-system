import "server-only";

import { NextResponse } from "next/server";

import { getClientIpForRateLimit } from "@/lib/rate-limit/client-ip";
import { checkMemorySlidingWindow } from "@/lib/rate-limit/memory-sliding-window";

/** 予約作成 POST: 同一 IP からの連投を抑止 */
const CREATE_LIMIT = 15;
const CREATE_WINDOW_MS = 60_000;

/** 確認コード照会 GET: 総当たりに対してやや厳しめ */
const TOKEN_GET_LIMIT = 40;
const TOKEN_GET_WINDOW_MS = 60_000;

/** 確認コード PATCH: 変更の乱用抑止 */
const TOKEN_PATCH_LIMIT = 20;
const TOKEN_PATCH_WINDOW_MS = 60_000;

/** 取消 POST */
const TOKEN_CANCEL_LIMIT = 10;
const TOKEN_CANCEL_WINDOW_MS = 60_000;

function tooManyResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "アクセスが集中しています。しばらくしてからお試しください。" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

export function rateLimitReservationCreate(request: Request): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `res:create:${ip}`,
    limit: CREATE_LIMIT,
    windowMs: CREATE_WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}

export function rateLimitReservationTokenGet(request: Request): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `res:token:get:${ip}`,
    limit: TOKEN_GET_LIMIT,
    windowMs: TOKEN_GET_WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}

export function rateLimitReservationTokenPatch(request: Request): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `res:token:patch:${ip}`,
    limit: TOKEN_PATCH_LIMIT,
    windowMs: TOKEN_PATCH_WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}

export function rateLimitReservationTokenCancel(request: Request): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  const r = checkMemorySlidingWindow({
    key: `res:token:cancel:${ip}`,
    limit: TOKEN_CANCEL_LIMIT,
    windowMs: TOKEN_CANCEL_WINDOW_MS,
  });
  if (!r.ok) return tooManyResponse(r.retryAfterSec);
  return null;
}
