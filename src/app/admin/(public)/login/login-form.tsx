"use client";

/** メール／パスワードで signInWithPassword。app_admins 確認後に ?next または開催日管理へ。 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { createClient } from "@/lib/supabase/client";

const MSG_NO_ADMIN_PERMISSION =
  "ログイン権限がありません。このアカウントは管理画面の利用者リストに登録されていません。システム管理者にお問い合わせください。";

/** Supabase Auth の英語メッセージを画面用の日本語に寄せる */
function signInErrorMessageJa(signError: { message?: string }): string {
  const raw = (signError.message ?? "").trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password") ||
    lower.includes("email and password") ||
    raw.includes("Invalid login credentials")
  ) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (lower.includes("email not confirmed")) {
    return "メールアドレスの確認が完了していません。受信トレイの確認リンクを開いてから再度お試しください。";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "試行回数が多すぎます。しばらく時間をおいてから再度お試しください。";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "通信に失敗しました。接続を確認のうえ、しばらくしてから再度お試しください。";
  }
  if (raw.length > 0 && /^[\x00-\x7F]+$/.test(raw)) {
    return "ログインに失敗しました。入力内容をご確認ください。";
  }
  return raw.length > 0 ? raw : "ログインに失敗しました。入力内容をご確認ください。";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/event-days";
  const forbidden = searchParams.get("forbidden") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** 保護画面から弾かれた直後など、URL の forbidden を一度だけ画面に出す */
  useEffect(() => {
    if (!forbidden) return;
    setError(MSG_NO_ADMIN_PERMISSION);
    router.replace("/admin/login", { scroll: false });
  }, [forbidden, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signError) {
      setLoading(false);
      setError(signInErrorMessageJa(signError));
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      setError("セッションの確立に失敗しました。もう一度お試しください。");
      return;
    }

    const checkRes = await fetch("/api/admin/auth-check", {
      credentials: "same-origin",
    });

    if (checkRes.ok) {
      setLoading(false);
      router.push(next);
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    if (checkRes.status === 403) {
      setError(MSG_NO_ADMIN_PERMISSION);
      return;
    }
    setError("サーバーとの通信に失敗しました。しばらくしてから再度お試しください。");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-md flex-col justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] sm:min-h-[60vh] sm:py-10">
      <p className="mb-4 text-center text-sm text-zinc-500">
        <Link href="/" className="underline decoration-zinc-400 underline-offset-2">
          予約サイトへ
        </Link>
      </p>
      <div className="mb-5 rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white px-4 py-4 shadow-sm ring-1 ring-emerald-900/5 sm:mb-6 sm:px-5 sm:py-5">
        <p className="text-xs font-medium text-emerald-800">主催・運営スタッフ専用</p>
        <h1 className="mt-2 text-lg font-semibold leading-snug text-zinc-900 sm:text-xl">
          管理画面ログイン
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          開催日・予約・対戦表・通知を管理するための画面です。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          登録済みの管理者アカウントでログインしてください。
        </p>
      </div>
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
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
