"use client";

/** お問い合わせ → POST /api/tournament-inquiries で保存・運営通知（任意） */
import { useState } from "react";

import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import { IconInfoCircle } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";

export default function ReserveContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournament-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: name.trim(),
          contactEmail: email.trim(),
          contactPhone: phone.trim(),
          message: message.trim(),
          sourcePath: "/reserve/contact",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(
          reserveFlowApiErrorDisplay(
            res.status,
            typeof json.error === "string" ? json.error : undefined,
            "送信に失敗しました"
          )
        );
        return;
      }
      setDoneMessage(
        json.message ??
          "お問い合わせを受け付けました。内容を確認のうえ、必要に応じてご連絡します。"
      );
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (e) {
      setError(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      setSubmitting(false);
    }
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
          大会運営へのご連絡用です。フォーム送信後、運営側で内容を確認します。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          予約完了メールが届かない場合は、「予約日」「チーム名」も分かる範囲でご記入ください。
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        お急ぎの場合は、画面下部のフッター「お問い合わせ」に記載の電話番号までお電話ください。
      </div>

      {doneMessage ? (
        <p className="rounded-xl border border-rp-mint-2 bg-rp-mint/50 px-4 py-3 text-sm text-zinc-800">
          {doneMessage}
        </p>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-5 rounded-2xl border border-rp-mint-2 bg-white p-5 shadow-sm sm:p-8"
        >
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">お名前</span>
            <span className="text-red-600"> *</span>
            <input
              required
              maxLength={200}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">メールアドレス</span>
            <span className="text-red-600"> *</span>
            <input
              required
              type="email"
              autoComplete="email"
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">電話番号</span>
            <span className="text-red-600"> *</span>
            <input
              required
              type="tel"
              maxLength={30}
              autoComplete="tel"
              placeholder="ハイフンありでも可"
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">お問い合わせ内容</span>
            <span className="text-red-600"> *</span>
            <textarea
              required
              rows={5}
              maxLength={8000}
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rp-brand px-8 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
          >
            {submitting ? "送信中…" : "送信する"}
          </button>
        </form>
      )}
    </div>
  );
}
