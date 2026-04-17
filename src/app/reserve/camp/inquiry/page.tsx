import { redirect } from "next/navigation";

/** 旧 URL。合宿相談は `/reserve/camp` に統合済み */
export default function ReserveCampInquiryLegacyPage() {
  redirect("/reserve/camp");
}
