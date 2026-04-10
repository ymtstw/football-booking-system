"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordHyphenPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/update-password");
  }, [router]);

  return (
    <main className="flex min-h-[40vh] items-center justify-center px-4 py-10 text-center text-sm text-zinc-600">
      <p>パスワード再設定ページへ移動しています…</p>
    </main>
  );
}
