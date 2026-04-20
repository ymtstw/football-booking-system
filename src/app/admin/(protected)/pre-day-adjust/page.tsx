import { redirect } from "next/navigation";

/** 編成調整は試合編成（前日確定）画面のタブへ統合（SCR-12） */
export default function AdminPreDayAdjustRedirectPage() {
  redirect("/admin/pre-day-results?tab=adjust");
}
