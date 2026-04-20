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
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
      <ReservePublicFooter />
    </div>
  );
}
