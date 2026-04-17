"use client";

/** お問い合わせ UI（メール送信は未接続の旨を表示） */
import { useState } from "react";

import { IconInfoCircle } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";

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
    <div className="space-y-8">
      <div>
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconInfoCircle className="h-6 w-6 sm:h-6 sm:w-6" />}
          textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
        >
          お問い合わせ
        </ReserveHeadingWithIcon>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
          大会運営へのご連絡用です。現在、ここからのメール自動送信は接続していません（送信ボタンは動作確認用です）。
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        実際の連絡は、配布資料や案内に記載の電話・メール等をご利用ください。
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-rp-mint-2 bg-white p-5 shadow-sm sm:p-8"
      >
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">お名前</span>
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">メールアドレス</span>
          <input
            type="email"
            className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">お問い合わせ内容</span>
          <textarea
            rows={5}
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        {submitted ? (
          <p className="rounded-lg border border-rp-mint-2 bg-rp-mint/50 px-3 py-2 text-sm text-zinc-800">
            （デモ）送信しました。本番ではここでメール送信 API を呼び出します。
          </p>
        ) : (
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rp-brand px-8 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover sm:w-auto"
          >
            送信する（デモ）
          </button>
        )}
      </form>
    </div>
  );
}
