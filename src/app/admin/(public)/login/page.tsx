/** 管理ログイン画面。useSearchParams 利用の LoginForm を Suspense で包む。 */
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-600">読み込み中…</p>}>
      <LoginForm />
    </Suspense>
  );
}
