/** 合宿相談の対応ステータス（DB camp_inquiries.status と一致） */

export const CAMP_INQUIRY_STATUSES = ["new", "in_progress", "done"] as const;

export type CampInquiryStatus = (typeof CAMP_INQUIRY_STATUSES)[number];

export function isCampInquiryStatus(s: string): s is CampInquiryStatus {
  return (CAMP_INQUIRY_STATUSES as readonly string[]).includes(s);
}

export function campInquiryStatusLabelJa(status: string): string {
  switch (status) {
    case "new":
      return "未対応";
    case "in_progress":
      return "対応中";
    case "done":
      return "対応済み";
    default:
      return status;
  }
}
