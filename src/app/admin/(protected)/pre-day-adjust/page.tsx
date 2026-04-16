import { redirect } from "next/navigation";

/** 確定補正は前日確定画面のタブへ統合（SCR-12） */
export default function AdminPreDayAdjustRedirectPage() {
  redirect("/admin/pre-day-results?tab=adjust");
}
