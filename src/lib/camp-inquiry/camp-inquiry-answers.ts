/** DB の answers jsonb を管理画面用に正規化 */

export function normalizeCampInquiryAnswers(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = v == null ? "" : String(v);
    }
  }
  return out;
}
