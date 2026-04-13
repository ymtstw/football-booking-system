/** メモリ上のスライディングウィンドウ（同一 Node プロセス内のみ有効） */

type WindowState = { hits: number[] };

const buckets = new Map<string, WindowState>();

const SWEEP_EVERY = 200;
let ops = 0;

function pruneHits(now: number, windowMs: number, hits: number[]): number[] {
  const since = now - windowMs;
  return hits.filter((t) => t > since);
}

function sweepStale(maxWindowMs: number) {
  const now = Date.now();
  const since = now - maxWindowMs * 2;
  for (const [key, state] of buckets) {
    const kept = state.hits.filter((t) => t > since);
    if (kept.length === 0) buckets.delete(key);
    else state.hits = kept;
  }
}

/**
 * @returns ok: true なら通す。false のとき retryAfterSec は Retry-After 用の秒
 */
export function checkMemorySlidingWindow(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const { key, limit, windowMs } = params;
  ops += 1;
  if (ops % SWEEP_EVERY === 0) sweepStale(windowMs);

  const now = Date.now();
  let state = buckets.get(key);
  if (!state) {
    state = { hits: [] };
    buckets.set(key, state);
  }
  state.hits = pruneHits(now, windowMs, state.hits);

  if (state.hits.length >= limit) {
    const oldest = state.hits[0]!;
    const resetAt = oldest + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  state.hits.push(now);
  return { ok: true };
}
