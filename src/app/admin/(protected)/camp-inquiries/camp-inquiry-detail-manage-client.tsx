"use client";

import { useState } from "react";

import {
  CAMP_INQUIRY_STATUSES,
  campInquiryStatusLabelJa,
} from "@/lib/camp-inquiry/camp-inquiry-status";

type Props = {
  inquiryId: string;
  initialStatus: string;
  contactEmail: string;
  contactPhone: string;
  teamName: string;
};

export function CampInquiryDetailManageClient({
  inquiryId,
  initialStatus,
  contactEmail,
  contactPhone,
  teamName,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyEmailState, setCopyEmailState] = useState<"idle" | "ok" | "err">(
    "idle"
  );
  const [copyPhoneState, setCopyPhoneState] = useState<"idle" | "ok" | "err">(
    "idle"
  );

  const mailtoHref =
    contactEmail.trim() !== ""
      ? `mailto:${encodeURIComponent(contactEmail.trim())}?subject=${encodeURIComponent(`合宿相談: ${teamName || "（団体名なし）"}`)}`
      : null;

  async function saveStatus() {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/camp-inquiries/${inquiryId}`, {
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
    <div className="space-y-6 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">対応ステータス</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          メール返信を始めたら「対応中」、完了したら「対応済み」に更新してください。自動判定はしません。
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
        <p className="mt-1 text-xs text-zinc-600">
          返信は通常メールから行ってください（本画面からの送信はありません）。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {mailtoHref ? (
            <a
              href={mailtoHref}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 underline-offset-2 hover:bg-zinc-50"
            >
              メールを作成（mailto）
            </a>
          ) : null}
          <button
            type="button"
            onClick={() =>
              void copyText(contactEmail, (v) => setCopyEmailState(v))
            }
            disabled={!contactEmail.trim()}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            メールアドレスをコピー
          </button>
          <button
            type="button"
            onClick={() =>
              void copyText(contactPhone, (v) => setCopyPhoneState(v))
            }
            disabled={!contactPhone.trim()}
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
      </div>
    </div>
  );
}
