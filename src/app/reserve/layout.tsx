import type { Metadata } from "next";

import { ReservePublicSiteShell } from "./_components/reserve-public-site-shell";

export const metadata: Metadata = {
  title: "小学生サッカー交流イベント｜案内と予約",
  description:
    "日帰り交流試合のイベント案内、開催日からの予約手続き、確認コードでの確認・キャンセル、合宿のご相談",
};

export default function ReserveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ReservePublicSiteShell>{children}</ReservePublicSiteShell>;
}
