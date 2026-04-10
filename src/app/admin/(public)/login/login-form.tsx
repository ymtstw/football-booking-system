"use client";

/** メール／パスワードで signInWithPassword。成功後は ?next または開催日管理へ。 */
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/event-days";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-md flex-col justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] sm:min-h-[60vh] sm:py-10">
      <p className="mb-4 text-center text-sm text-zinc-500">
        <Link href="/" className="underline decoration-zinc-400 underline-offset-2">
          サイトトップへ
        </Link>
      </p>
      <h1 className="mb-5 text-lg font-semibold text-zinc-900 sm:mb-6 sm:text-xl">
        管理画面ログイン
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">メールアドレス</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">パスワード</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
          />
        </label>
        {error ? (
          <p className="text-sm leading-relaxed text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
