import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

import { ReservePublicFooter } from "./_components/reserve-public-footer";
import { ReservePublicHeader } from "./_components/reserve-public-header";

const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "小学生サッカー対戦予約",
  description:
    "交流試合（日帰り）の予約・確認コードでの確認・キャンセル・合宿のご相談",
};

export default function ReserveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${notoSansJp.className} flex min-h-dvh flex-col bg-rp-page text-slate-900 antialiased`}
    >
      <ReservePublicHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8 md:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
      <ReservePublicFooter />
    </div>
  );
}
