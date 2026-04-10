"use client";

/** お問い合わせ UI のみ（メール送信は未接続）。 */
import { useState } from "react";

export default function ReserveContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          お問い合わせ
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          大会運営への連絡用フォームです。現在、ここからのメール自動送信は接続していません。送信ボタンは動作のイメージ確認用です。
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950 sm:px-4">
        実際の連絡は、配布資料や案内に記載の連絡先（電話・メール等）をご利用ください。
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-4"
      >
        <label className="block text-sm">
          <span className="text-zinc-700">お名前</span>
          <input
            className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-700">メールアドレス</span>
          <input
            type="email"
            className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-700">お問い合わせ内容</span>
          <textarea
            rows={5}
            className="mt-1 min-h-[8rem] w-full resize-y rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        {submitted ? (
          <p className="text-sm leading-relaxed text-zinc-700">
            （デモ）送信しました。本番ではここでメール送信 API を呼び出します。いまはメールは送られていません。
          </p>
        ) : (
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
          >
            送信する（デモ）
          </button>
        )}
      </form>
    </div>
  );
}
