"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordHyphenPage() {
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
