/** メールパスワード再設定の画面シェル。処理本体は UpdatePasswordForm。 */
import { Suspense } from "react";

import { UpdatePasswordForm } from "./update-password-form";

export const dynamic = "force-dynamic";

export default function AuthUpdatePasswordPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900">
        パスワード再設定
      </h1>
      <Suspense fallback={<p className="text-zinc-600">読み込み中…</p>}>
        <UpdatePasswordForm />
      </Suspense>
    </main>
  );
}
