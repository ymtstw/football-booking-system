import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "予約の確認・変更 | 小学生サッカー対戦予約",
  description:
    "予約完了メールに記載された確認コードを入力し、予約内容の確認・変更・キャンセルができます。",
};

export default function ReserveManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
