"use client";

/** メールリンク由来の URL 形（code / hash / token 等）からセッションを立て、新パスワードを updateUser。 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // 初回表示だけ: URL にトークンが # に載っているときは、すぐフォームを出してよい（code だけは交換待ち）
  const [ready, setReady] = useState(() => {
    if (typeof window === "undefined") return false;
    const u = new URL(window.location.href);
    if (u.searchParams.get("code")) return false;
    const h = u.hash;
    return h.includes("type=recovery") || h.includes("access_token");
  });

  const [bootError, setBootError] = useState<string | null>(null);
  const [bootDone, setBootDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Supabase が内部で「パスワード再設定モード」に入ったときにも ready にする
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    void (async () => {
      try {
        const url = new URL(window.location.href);

        // /auth/callback から失敗で戻ってきたときのクエリ
        const err = url.searchParams.get("error");
        if (err === "auth_callback") {
          setBootError(
            "リンクの有効期限が切れているか、すでに使用済みです。パスワード再設定メールを再送してください。"
          );
          return;
        }
        if (err === "missing_code") {
          setBootError(
            "認証用のコードがありません。メールの「Reset Password」からもう一度開いてください。"
          );
          return;
        }

        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setBootError(error.message);
            return;
          }
          setReady(true);
          // URL から code を消して見た目をすっきり（リロードで二重実行しにくくする）
          window.history.replaceState(null, "", url.pathname);
          return;
        }

        const tokenHash = url.searchParams.get("token_hash");
        const otpType = url.searchParams.get("type");
        if (tokenHash && otpType === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (error) {
            setBootError(error.message);
            return;
          }
          setReady(true);
          window.history.replaceState(null, "", url.pathname);
          return;
        }

        const hashRaw = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const hashParams = new URLSearchParams(hashRaw);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setBootError(error.message);
            return;
          }
          setReady(true);
          window.history.replaceState(null, "", url.pathname);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setReady(true);
        }
      } finally {
        setBootDone(true);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setMessage("パスワードが一致しません");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("更新しました。管理画面へ移動します。");
    setTimeout(() => {
      router.push("/admin/login");
      router.refresh();
    }, 800);
  }

  if (bootError) {
    return (
      <div className="max-w-md space-y-3 text-sm text-zinc-700">
        <p className="text-red-700">{bootError}</p>
        <p>
          Gmail などでリンクを開くと <code className="rounded bg-zinc-100 px-1">?code=</code>{" "}
          が付いた URL になるはずです。アドレスバーに{" "}
          <code className="rounded bg-zinc-100 px-1">code=</code> または{" "}
          <code className="rounded bg-zinc-100 px-1">#access_token</code>{" "}
          があるか確認し、もう一度メールから「Reset Password」を開いてください。
        </p>
        <Link href="/admin/login" className="text-zinc-600 underline">
          管理ログインへ
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="text-zinc-600">
        {bootDone
          ? "セッションを取得できませんでした。メールのリンクをもう一度開くか、パスワード再設定を再送してください。"
          : "リンクを確認しています…"}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600">新しいパスワード</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600">確認</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          className="rounded border border-zinc-300 px-3 py-2"
        />
      </label>
      {message ? (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "更新中…" : "パスワードを設定"}
      </button>
      <Link href="/admin/login" className="text-sm text-zinc-600 underline">
        管理ログインへ
      </Link>
    </form>
  );
}
