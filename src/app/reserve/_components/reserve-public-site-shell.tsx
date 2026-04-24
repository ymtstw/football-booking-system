import { Noto_Sans_JP } from "next/font/google";

import { ReservePublicFooter } from "./reserve-public-footer";
import { ReservePublicHeader } from "./reserve-public-header";

const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

/** 予約サイト公開部の共通枠（ヘッダー・本文エリア・フッター）。`/` と `/reserve/*` で共有 */
export function ReservePublicSiteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${notoSansJp.className} flex min-h-dvh flex-col bg-rp-page text-slate-900 antialiased`}
    >
      <ReservePublicHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 lg:px-10 lg:pb-8 lg:pt-4">
        {children}
      </main>
      <ReservePublicFooter />
    </div>
  );
}
