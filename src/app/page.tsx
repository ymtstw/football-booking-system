import type { Metadata } from "next";

import { HomeReserveRoot } from "./home-reserve-root";
import { ReservePublicSiteShell } from "./reserve/_components/reserve-public-site-shell";

export const metadata: Metadata = {
  title: "小学生サッカー交流イベント｜案内と予約",
  description:
    "日帰り交流試合のイベント案内、開催日からの予約手続き、確認コードでの確認・キャンセル、合宿のご相談",
};

/** サイトトップ＝イベント案内。予約手続きは /reserve/calendar から。 */
export default function HomePage() {
  return (
    <ReservePublicSiteShell>
      <HomeReserveRoot />
    </ReservePublicSiteShell>
  );
}
