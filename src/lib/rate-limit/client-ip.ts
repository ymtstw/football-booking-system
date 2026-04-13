/**
 * 公開 API のレート制限キー用。プロキシ経由のクライアント IP を推定する。
 * （サーバーレスではインスタンス単位のため分散環境では近似。設計書の最低限の抑止として利用）
 */
export function getClientIpForRateLimit(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}
