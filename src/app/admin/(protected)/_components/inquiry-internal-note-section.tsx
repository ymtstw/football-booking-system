"use client";

import { useState } from "react";

import { INQUIRY_INTERNAL_NOTE_MAX_LEN } from "@/lib/admin/inquiry-internal-note-api";

type Props = {
  /** フォーム id の一意化・同一ページに複数置く場合の重複防止用（開催の問い合わせ UUID など） */
  inquiryId: string;
  apiPath: string;
  initialInternalNote: string | null;
};

function safeServerErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const err = (json as { error?: unknown }).error;
  if (typeof err !== "string") return null;
  const t = err.trim();
  return t.length > 0 ? t : null;
}

/**
 * 合宿相談・大会お問い合わせ詳細の管理者用対応メモ（PATCH のみ。公開 API とは別）。
 */
export function InquiryInternalNoteSection({
  inquiryId,
  apiPath,
  initialInternalNote,
}: Props) {
  const headingId = `inquiry-internal-note-heading-${inquiryId}`;
  const fieldId = `inquiry-internal-note-${inquiryId}`;

  const [text, setText] = useState(initialInternalNote ?? "");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function save() {
    setStatusMessage(null);
    setSaving(true);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_note: text }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        internal_note?: string | null;
      };
      if (!res.ok) {
        setStatusMessage({
          kind: "error",
          text:
            safeServerErrorMessage(json) ?? "メモの保存に失敗しました",
        });
        return;
      }
      const next =
        typeof json.internal_note === "string"
          ? json.internal_note
          : json.internal_note === null
            ? ""
            : text;
      setText(next);
      setStatusMessage({ kind: "success", text: "メモを保存しました" });
    } catch {
      setStatusMessage({
        kind: "error",
        text: "メモの保存に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="text-sm font-semibold text-zinc-900"
      >
        対応メモ
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-zinc-600 sm:text-sm">
        この問い合わせに関する管理者用メモです。お客様には表示・送信されません。
      </p>
      <label htmlFor={fieldId} className="sr-only">
        対応メモ
      </label>
      <textarea
        id={fieldId}
        name="internal_note"
        rows={5}
        maxLength={INQUIRY_INTERNAL_NOTE_MAX_LEN}
        placeholder="例：電話済み、見積もり確認中、希望日程、次回連絡予定など"
        className="mt-3 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 sm:text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={saving}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 sm:text-xs">
        <span>{text.length} / {INQUIRY_INTERNAL_NOTE_MAX_LEN}</span>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {saving ? "保存中…" : "メモを保存"}
        </button>
      </div>
      {statusMessage ? (
        <p
          className={
            statusMessage.kind === "success"
              ? "mt-3 text-sm font-medium text-emerald-800"
              : "mt-3 text-sm font-medium text-red-800"
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}
