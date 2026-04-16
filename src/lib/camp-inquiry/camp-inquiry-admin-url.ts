import "server-only";

/** 管理画面の合宿相談詳細 URL（通知メール用）。未設定時は null。 */
export function buildAdminCampInquiryDetailUrl(inquiryId: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/admin/camp-inquiries/${inquiryId}`;
}
