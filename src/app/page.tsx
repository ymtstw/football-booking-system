/** サイトルート。通常は /reserve へリダイレクト。パスワード再設定の # 付き URL は AuthHashRedirect が処理。 */
import { AuthHashRedirect } from "./auth-hash-redirect";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <AuthHashRedirect />
    </div>
  );
}
