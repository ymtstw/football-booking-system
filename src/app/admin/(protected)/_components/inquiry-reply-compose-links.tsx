"use client";

import { useState } from "react";

type Props = {
  outlookWebHref: string | null;
  mailtoHref: string | null;
  urlTruncated: boolean;
  /** 宛先・件名・全文本文（URL 省略なし） */
  replyClipboardText: string;
};

/** お問い合わせ返信: Outlook（Web）/ mailto と返信用テキストのコピー */
export function InquiryReplyComposeLinks({
  outlookWebHref,
  mailtoHref,
  urlTruncated,
  replyClipboardText,
}: Props) {
  const [copyDraftState, setCopyDraftState] = useState<"idle" | "ok" | "err">(
    "idle"
  );

  async function copyReplyDraft() {
    setCopyDraftState("idle");
    try {
      await navigator.clipboard.writeText(replyClipboardText);
      setCopyDraftState("ok");
      setTimeout(() => setCopyDraftState("idle"), 2500);
    } catch {
      setCopyDraftState("err");
    }
  }

  const linkClass =
    "inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50";

  return (
    <>
      {urlTruncated ? (
        <p className="mt-2 text-xs text-amber-800">
          内容が長いため、Web／アプリに渡す本文の一部が省略されている場合があります。下の「返信用テキストをコピー」か「受付内容」欄で全文をご確認ください。
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {outlookWebHref ? (
          <a
            href={outlookWebHref}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Outlook（Web）で作成
          </a>
        ) : null}
        {mailtoHref ? (
          <a
            href={mailtoHref}
            className={linkClass}
          >
            PCのメールアプリ
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => void copyReplyDraft()}
          disabled={!replyClipboardText.trim()}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        >
          返信用テキストをコピー
        </button>
      </div>
      {copyDraftState === "ok" ? (
        <p className="mt-2 text-xs text-emerald-800" role="status">
          宛先・件名・本文をコピーしました。メールに貼り付けてください。
        </p>
      ) : copyDraftState === "err" ? (
        <p className="mt-2 text-xs text-red-700">
          コピーに失敗しました（ブラウザの権限をご確認ください）
        </p>
      ) : null}
    </>
  );
}
