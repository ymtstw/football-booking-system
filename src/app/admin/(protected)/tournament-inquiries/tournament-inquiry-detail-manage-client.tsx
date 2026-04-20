"use client";

import { useState } from "react";

import { InquiryReplyComposeLinks } from "../_components/inquiry-reply-compose-links";
import {
  CAMP_INQUIRY_STATUSES,
  campInquiryStatusLabelJa,
} from "@/lib/camp-inquiry/camp-inquiry-status";

type Props = {
  inquiryId: string;
  initialStatus: string;
  contactEmail: string;
  outlookWebHref: string | null;
  mailtoHref: string | null;
  mailtoTruncated: boolean;
  replyClipboardText: string;
};

export function TournamentInquiryDetailManageClient({
  inquiryId,
  initialStatus,
  contactEmail,
  outlookWebHref,
  mailtoHref,
  mailtoTruncated,
  replyClipboardText,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

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

  async function copyEmail() {
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(contactEmail.trim());
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("err");
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">対応ステータス</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          返信を始めたら「対応中」、完了したら「対応済み」に更新してください。
          メールで追加のやりとりがあり、再度手を付ける必要があるときは「要再対応」に変更してください（自動では変わりません）。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving}
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
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
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">連絡用</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          本サイトからメールを送信する機能はありません。下のボタンでブラウザのメールや下書きをご利用ください。
        </p>
        <InquiryReplyComposeLinks
          outlookWebHref={outlookWebHref}
          mailtoHref={mailtoHref}
          urlTruncated={mailtoTruncated}
          replyClipboardText={replyClipboardText}
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => void copyEmail()}
            disabled={!contactEmail.trim()}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            メールアドレスのみコピー
          </button>
        </div>
        {copyState === "ok" ? (
          <p className="mt-2 text-xs text-emerald-800">コピーしました</p>
        ) : copyState === "err" ? (
          <p className="mt-2 text-xs text-red-700">
            コピーに失敗しました（ブラウザの権限をご確認ください）
          </p>
        ) : null}
      </div>
    </div>
  );
}
