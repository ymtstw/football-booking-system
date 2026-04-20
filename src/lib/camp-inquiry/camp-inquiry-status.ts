/** 合宿相談・大会お問い合わせの対応ステータス（DB status と一致） */

export const CAMP_INQUIRY_STATUSES = [
  "new",
  "in_progress",
  "follow_up",
  "done",
] as const;

export type CampInquiryStatus = (typeof CAMP_INQUIRY_STATUSES)[number];

export function isCampInquiryStatus(s: string): s is CampInquiryStatus {
  return (CAMP_INQUIRY_STATUSES as readonly string[]).includes(s);
}

/** API 422 など用の許可値表記 */
export const CAMP_INQUIRY_STATUS_VALUES_HINT =
  "new / in_progress / follow_up / done";

export function campInquiryStatusLabelJa(status: string): string {
  switch (status) {
    case "new":
      return "未対応";
    case "in_progress":
      return "対応中";
    case "follow_up":
      return "要再対応";
    case "done":
      return "対応済み";
    default:
      return status;
  }
}
