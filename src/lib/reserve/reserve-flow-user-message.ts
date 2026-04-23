/**
 * 予約フロント: 定番の fetch / ブラウザ由来の英語を利用者向け日本語に寄せる。
 * API が返す日本語はそのまま通す（上書きしない）。
 */

export const RESERVE_FLOW_NETWORK_ERROR_JA =
  "通信に失敗しました。接続をご確認のうえ、しばらくしてから再度お試しください。";

const ABORT_JA = "通信が中断されました。もう一度お試しください。";
const TIMEOUT_JA = "時間切れになりました。もう一度お試しください。";
const BAD_RESPONSE_JA =
  "サーバーからの応答を読み取れませんでした。時間をおいて再度お試しください。";

function looksLikeNetworkOrBrowserFailure(t: string): boolean {
  const lower = t.toLowerCase();
  if (lower.includes("failed to fetch")) return true;
  if (lower.includes("networkerror")) return true;
  if (lower.includes("network request failed")) return true;
  if (lower.includes("load failed")) return true;
  if (lower.includes("fetch") && lower.includes("failed")) return true;
  if (lower.includes("net::err")) return true;
  if (lower.includes("err_connection")) return true;
  if (lower.includes("err_name_not_resolved")) return true;
  if (lower.includes("err_internet_disconnected")) return true;
  return false;
}

function looksLikeAbort(t: string): boolean {
  const lower = t.toLowerCase();
  return lower.includes("aborterror") || lower === "abort" || t === "AbortError";
}

function looksLikeTimeout(t: string): boolean {
  const lower = t.toLowerCase();
  return lower.includes("timeout") || lower.includes("timed out");
}

function looksLikeJsonEngineNoise(t: string): boolean {
  const lower = t.toLowerCase();
  return (
    lower.includes("unexpected token") ||
    lower.includes("is not valid json") ||
    lower.includes("json.parse") ||
    lower.includes("syntaxerror") ||
    lower.includes("unexpected end of json")
  );
}

/** DB 由来の英語が万一クライアントに届いたときの最後の防波堤 */
function looksLikeSqlishLeak(t: string): boolean {
  const lower = t.toLowerCase();
  return (
    lower.includes("invalid input value for enum") ||
    lower.includes("violates foreign key") ||
    lower.includes("violates check constraint") ||
    lower.includes("syntax error at") ||
    lower.includes("permission denied for")
  );
}

/**
 * @param raw API の error 文言、または Error.message
 * @param fallbackJa 空・SQL漏れ・不明時
 */
export function reserveFlowUserVisibleMessage(
  raw: string | null | undefined,
  fallbackJa: string
): string {
  const t = (raw ?? "").trim();
  if (!t) return fallbackJa;
  if (looksLikeNetworkOrBrowserFailure(t)) return RESERVE_FLOW_NETWORK_ERROR_JA;
  if (looksLikeAbort(t)) return ABORT_JA;
  if (looksLikeTimeout(t)) return TIMEOUT_JA;
  if (looksLikeJsonEngineNoise(t)) return BAD_RESPONSE_JA;
  if (looksLikeSqlishLeak(t)) return fallbackJa;
  return t;
}

/**
 * HTTP ステータスと API の error を組み合わせて表示用文言にする（本文が空なら status で補完）。
 */
export function reserveFlowApiErrorDisplay(
  status: number,
  bodyError: string | null | undefined,
  fallbackJa: string
): string {
  const raw = (bodyError ?? "").trim();
  if (raw) {
    return reserveFlowUserVisibleMessage(raw, fallbackJa);
  }
  if (status === 429) {
    return "アクセスが集中しています。しばらくしてから再度お試しください。";
  }
  if (status === 503 || status === 502 || status === 504) {
    return "サービスが一時的に利用できません。しばらくしてから再度お試しください。";
  }
  return fallbackJa;
}
