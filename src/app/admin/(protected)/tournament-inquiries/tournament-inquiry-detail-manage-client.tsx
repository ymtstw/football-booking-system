"use client";

import { useState } from "react";

import { InquiryReplyComposeLinks } from "../_components/inquiry-reply-compose-links";
import {
  CAMP_INQUIRY_STATUSES,
  campInquiryStatusLabelJa,
} from "@/lib/camp-inquiry/camp-inquiry-status";

type StatusProps = {
  inquiryId: string;
  initialStatus: string;
};

/** 対応状況（ステータス選択・保存） */
export function TournamentInquiryStatusSection({
  inquiryId,
  initialStatus,
}: StatusProps) {
  const [status, setStatus] = useState(initialStatus);
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveStatus() {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournament-inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "更新に失敗しました");
        return;
      }
      setSavedStatus(status);
      setMessage("ステータスを保存しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"
      aria-labelledby="tournament-inquiry-status-heading"
    >
      <h2
        id="tournament-inquiry-status-heading"
        className="text-sm font-semibold text-zinc-900"
      >
        対応状況
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`tournament-inquiry-status-${inquiryId}`} className="sr-only">
          ステータス
        </label>
        <select
          id={`tournament-inquiry-status-${inquiryId}`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={saving}
          className="min-h-10 min-w-0 max-w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        >
          {CAMP_INQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {campInquiryStatusLabelJa(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void saveStatus()}
          disabled={saving || status === savedStatus}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-xs text-zinc-700" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

type ContactProps = {
  contactEmail: string;
  contactPhone: string | null;
  outlookWebHref: string | null;
  mailtoHref: string | null;
  mailtoTruncated: boolean;
  replyClipboardText: string;
};

/** 連絡する（外部メール・コピー） */
export function TournamentInquiryContactSection({
  contactEmail,
  contactPhone,
  outlookWebHref,
  mailtoHref,
  mailtoTruncated,
  replyClipboardText,
}: ContactProps) {
  const phone = contactPhone?.trim() ?? "";
  const [copyEmailState, setCopyEmailState] = useState<"idle" | "ok" | "err">(
    "idle"
  );
  const [copyPhoneState, setCopyPhoneState] = useState<"idle" | "ok" | "err">(
    "idle"
  );

  async function copyText(
    text: string,
    setState: (v: "idle" | "ok" | "err") => void
  ) {
    setState("idle");
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("err");
    }
  }

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"
      aria-labelledby="tournament-inquiry-contact-heading"
    >
      <h2
        id="tournament-inquiry-contact-heading"
        className="text-sm font-semibold text-zinc-900"
      >
        連絡する
      </h2>
      <div className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600">
        <p>この画面からメールは自動送信されません。</p>
        <p>普段お使いのメールソフトまたは電話でご連絡ください。</p>
        <p>
          メールソフトがうまく開かない場合は、メールアドレスや返信文をコピーしてご利用ください。
        </p>
      </div>
      <div className="mt-3">
        <InquiryReplyComposeLinks
          outlookWebHref={outlookWebHref}
          mailtoHref={mailtoHref}
          urlTruncated={mailtoTruncated}
          replyClipboardText={replyClipboardText}
        />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() =>
            void copyText(contactEmail.trim(), (v) => setCopyEmailState(v))
          }
          disabled={!contactEmail.trim()}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        >
          メールをコピー
        </button>
        <button
          type="button"
          onClick={() => void copyText(phone, (v) => setCopyPhoneState(v))}
          disabled={!phone}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        >
          電話番号をコピー
        </button>
      </div>
      {copyEmailState === "ok" ? (
        <p className="mt-2 text-xs text-emerald-800">メールをコピーしました</p>
      ) : copyEmailState === "err" ? (
        <p className="mt-2 text-xs text-red-700">
          メールのコピーに失敗しました（ブラウザの権限をご確認ください）
        </p>
      ) : null}
      {copyPhoneState === "ok" ? (
        <p className="mt-2 text-xs text-emerald-800">電話番号をコピーしました</p>
      ) : copyPhoneState === "err" ? (
        <p className="mt-2 text-xs text-red-700">電話のコピーに失敗しました</p>
      ) : null}
    </section>
  );
}
