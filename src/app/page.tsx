import type { Metadata } from "next";

import { HomeReserveRoot } from "./home-reserve-root";
import { ReservePublicSiteShell } from "./reserve/_components/reserve-public-site-shell";

export const metadata: Metadata = {
  title: "小学生サッカー対戦予約｜案内と予約",
  description:
    "小学生チーム向け日帰り対戦イベントの案内。開催日の選定・予約、確認コードでの確認・キャンセル、合宿のご相談",
};

/** サイトトップ＝イベント案内。予約手続きは /reserve/calendar から。 */
export default function HomePage() {
  return (
    <ReservePublicSiteShell>
      <HomeReserveRoot />
    </ReservePublicSiteShell>
  );
}
