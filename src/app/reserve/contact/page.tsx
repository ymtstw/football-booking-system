"use client";

/** お問い合わせ → POST /api/tournament-inquiries で保存・運営通知（任意） */
import { useState } from "react";

import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import { PhoneNumber } from "@/components/ui/phone-number";
import { IconCheck, IconInfoCircle } from "../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";

/** 予約関連の問い合わせ時に本文へ書いてほしい内容の案内（お問い合わせ内容の入力欄直上） */
const RESERVATION_INQUIRY_HINT_LINES_JA = [
  "予約に関するお問い合わせの場合は、予約番号をご記入ください。",
  "不明な場合は、予約日・チーム名などで構いません。",
] as const;

const CONTACT_REPLY_NOTE_JA = "お問い合わせ内容を確認のうえ、担当者よりご連絡いたします。";
const CONTACT_PHONE =
  process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "090-2901-0015";

export default function ReserveContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const emailA = email.trim().toLowerCase();
    const emailB = emailConfirm.trim().toLowerCase();
    if (emailA !== emailB) {
      setError("メールアドレスが一致しません。同じ内容を2回入力してください。");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournament-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: name.trim(),
          contactEmail: email.trim(),
          contactEmailConfirm: emailConfirm.trim(),
          contactPhone: phone.trim(),
          message: message.trim(),
          sourcePath: "/reserve/contact",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
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
      setSubmitted(true);
      setName("");
      setEmail("");
      setEmailConfirm("");
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
    <div className="space-y-5 sm:space-y-6">
      <div>
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconInfoCircle className="h-6 w-6 sm:h-6 sm:w-6" />}
          textClassName="text-xl font-bold text-rp-navy sm:text-2xl"
        >
          お問い合わせ
        </ReserveHeadingWithIcon>
        {!submitted ? (
          <div className="mt-2 text-sm leading-snug text-zinc-600">
            <p>{CONTACT_REPLY_NOTE_JA}</p>
          </div>
        ) : null}
      </div>

      {!submitted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-950 sm:px-4 sm:py-2.5">
          お急ぎの方は、ページ下部の電話番号までご連絡ください。
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 sm:px-4 sm:py-2.5">
        メールが届かず、確認コードもお控えでない場合は、再度予約登録を行わず、
        <PhoneNumber
          phone={CONTACT_PHONE}
          className="mx-1 font-semibold underline decoration-amber-600/50 underline-offset-2"
        />
        までお電話ください。
      </div>

      {submitted ? (
        <div className="space-y-4 rounded-xl border border-rp-mint-2 bg-rp-mint/70 px-4 py-4 sm:px-5">
          <ReserveHeadingWithIcon
            as="h2"
            shell="navy"
            icon={<IconCheck className="h-5 w-5" strokeWidth={2.25} />}
            textClassName="text-sm font-bold text-rp-navy"
          >
            お問い合わせを受け付けました
          </ReserveHeadingWithIcon>
          <div className="space-y-3 text-[15px] leading-relaxed text-zinc-800 sm:text-sm">
            <p>お問い合わせありがとうございます。</p>
            <p>内容を確認のうえ、必要に応じて担当者よりご連絡します。</p>
            <p>お急ぎの場合は、ページ下部の電話番号までご連絡ください。</p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 rounded-2xl border border-rp-mint-2 bg-white p-4 shadow-sm sm:space-y-5 sm:p-6"
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
              placeholder="例：example@example.com"
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">メールアドレス（確認）</span>
            <span className="text-red-600"> *</span>
            <input
              required
              type="email"
              autoComplete="off"
              placeholder="上と同じメールを再入力"
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
            />
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
              確認のため、もう一度同じアドレスを入力してください。
            </span>
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
            <div className="mt-1 space-y-0.5 text-xs leading-snug text-zinc-500 sm:text-sm sm:leading-snug">
              {RESERVATION_INQUIRY_HINT_LINES_JA.map((line) => (
                <p key={line} className="m-0">
                  {line}
                </p>
              ))}
            </div>
            <textarea
              required
              rows={5}
              maxLength={8000}
              placeholder={
                "例：\n4月27日の予約について確認したいです。\nチーム名は〇〇FCです。"
              }
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
