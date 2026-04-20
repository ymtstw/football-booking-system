import { redirect } from "next/navigation";

/** 旧プレースホルダ。枠編集は開催日一覧の各行「枠・時刻」から。 */
export default function AdminEventDaySlotsRedirectPage() {
  redirect("/admin/event-days");
}
