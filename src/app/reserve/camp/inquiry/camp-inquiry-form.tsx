"use client";

import { useMemo, useState } from "react";

import {
  CAMP_INQUIRY_FIELD_DEFS,
  emptyCampInquiryFormState,
  type CampInquiryFieldDef,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";

function sectionHeading(section: CampInquiryFieldDef["section"]): string {
  if (section === "contact") return "ご連絡先";
  if (section === "consult") return "ご希望（日程・プランの目安）";
  return "任意（分かる範囲で）";
}

function renderField(
  def: CampInquiryFieldDef,
  value: string,
  onChange: (id: string, v: string) => void,
  disabled: boolean
) {
  const commonLabel = (
    <span className="text-zinc-800">
      {def.labelJa}
      {def.required ? (
        <span className="ml-0.5 text-red-600" aria-hidden>
          *
        </span>
      ) : null}
    </span>
  );

  const desc = def.descriptionJa ? (
    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{def.descriptionJa}</p>
  ) : null;

  if (def.type === "textarea") {
    return (
      <label key={def.id} className="block text-sm">
        {commonLabel}
        {desc}
        <textarea
          rows={def.rows ?? 4}
          maxLength={def.maxLength}
          disabled={disabled}
          className="mt-1 min-h-24 w-full resize-y rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
          value={value}
          onChange={(e) => onChange(def.id, e.target.value)}
          placeholder={def.placeholderJa}
        />
      </label>
    );
  }

  if (def.type === "select") {
    return (
      <label key={def.id} className="block text-sm">
        {commonLabel}
        {desc}
        <select
          disabled={disabled}
          className="mt-1 min-h-11 w-full rounded border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
          value={value}
          onChange={(e) => onChange(def.id, e.target.value)}
        >
          <option value="">{def.required ? "選択してください" : "（未選択）"}</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.labelJa}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const inputType =
    def.type === "email" ? "email" : def.type === "tel" ? "tel" : def.type === "number" ? "number" : "text";

  return (
    <label key={def.id} className="block text-sm">
      {commonLabel}
      {desc}
      <input
        type={inputType}
        min={def.type === "number" ? def.numberMin ?? 0 : undefined}
        step={def.type === "number" ? 1 : undefined}
        maxLength={def.type === "number" ? undefined : def.maxLength}
        disabled={disabled}
        className="mt-1 min-h-11 w-full rounded border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 sm:text-sm"
        value={value}
        onChange={(e) => onChange(def.id, e.target.value)}
        placeholder={def.placeholderJa}
        autoComplete={
          def.id === "contact_email"
            ? "email"
            : def.id === "contact_phone"
              ? "tel"
              : def.id === "contact_name"
                ? "name"
                : undefined
        }
      />
    </label>
  );
}

export function CampInquiryForm() {
  const initial = useMemo(() => emptyCampInquiryFormState(), []);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  function update(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/camp-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: values,
          sourcePath: "/reserve/camp/inquiry",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "送信に失敗しました");
        return;
      }
      setDoneMessage(
        json.message ??
          "合宿相談を受け付けました。内容を確認のうえ、運営より事前にご連絡します。この時点では予約確定ではありません。当日の進行などは各チーム・現場でお願いします。"
      );
      setValues(emptyCampInquiryFormState());
    } finally {
      setSubmitting(false);
    }
  }

  const bySection = useMemo(() => {
    const contact = CAMP_INQUIRY_FIELD_DEFS.filter((d) => d.section === "contact");
    const consult = CAMP_INQUIRY_FIELD_DEFS.filter((d) => d.section === "consult");
    const optional = CAMP_INQUIRY_FIELD_DEFS.filter((d) => d.section === "optional");
    return { contact, consult, optional };
  }, []);

  if (doneMessage) {
    return (
      <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-emerald-950">合宿相談を受け付けました</h2>
        <p className="text-sm leading-relaxed text-emerald-950/95">{doneMessage}</p>
        <p className="text-xs leading-relaxed text-emerald-900/90">
          開催前のご調整は、運営からの返信メールにて行います。当日運用までのシステム化はしません。日帰り交流試合の予約カレンダーとは別のお手続きです。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 sm:px-4 sm:py-3.5">
        <p className="text-sm font-medium text-zinc-900">ご入力について</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-600">
          <li>まずはご希望の日程とプラン、参加予定人数の目安をお知らせください。</li>
          <li>
            参加人数や詳細が<strong className="text-zinc-800">未確定でも</strong>
            ご相談いただけます。交流試合の希望などは「ご相談内容」に自由記述で構いません。
          </li>
          <li>内容を確認のうえ、運営より<strong className="text-zinc-800">ご案内</strong>します。</li>
          <li>
            <strong className="text-zinc-800">このフォーム送信時点では予約確定ではありません。</strong>
          </li>
          <li>
            合宿開催が決まった<strong className="text-zinc-800">当日</strong>の試合順・チーム間の進行・現場運営の細部は、本サイトでは扱いません（各チーム・現場での調整をお願いします）。
          </li>
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-5"
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {sectionHeading("contact")}
          </h2>
          <div className="space-y-4">
            {bySection.contact.map((def) => renderField(def, values[def.id] ?? "", update, submitting))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {sectionHeading("consult")}
          </h2>
          <div className="space-y-4">
            {bySection.consult.map((def) => renderField(def, values[def.id] ?? "", update, submitting))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {sectionHeading("optional")}
          </h2>
          <p className="text-xs leading-relaxed text-zinc-500">
            以下は未入力のままで送信できます。
          </p>
          <div className="space-y-4">
            {bySection.optional.map((def) => renderField(def, values[def.id] ?? "", update, submitting))}
          </div>
        </section>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:bg-zinc-400 sm:w-auto"
        >
          {submitting ? "送信中…" : "相談内容を送信する（確定ではありません）"}
        </button>
      </form>
    </div>
  );
}
