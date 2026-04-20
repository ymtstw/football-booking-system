import { permanentRedirect } from "next/navigation";

/** 旧トップ URL。イベント案内はサイトルート `/` に統一 */
export default function ReserveLegacyTopRedirect() {
  permanentRedirect("/");
}
