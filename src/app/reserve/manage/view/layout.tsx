import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "予約内容の確認 | 小学生サッカー対戦予約",
};

export default function ReserveManageViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
