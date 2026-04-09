"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ミドルウェアでも `/auth/update-password` へ送るが、
 * キャッシュや直リンクでここに残った場合のフォールバック。
 */
export default function ResetPasswordAliasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/update-password");
  }, [router]);

  return (
    <main className="p-8 text-center text-zinc-600">
      <p>パスワード再設定ページへ移動しています…</p>
    </main>
  );
}
