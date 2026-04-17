"use client";

import { useMemo, useState } from "react";

import {
  IconCheck,
  IconClipboard,
  IconInfoCircle,
  IconTent,
} from "../../_components/reserve-icons";
import { ReserveHeadingWithIcon } from "../../_components/ui/reserve-heading-with-icon";
import {
  CAMP_INQUIRY_PUBLIC_FIELD_DEFS,
  emptyCampInquiryFormState,
  type CampInquiryFieldDef,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";

export type CampInquiryFormProps = {
  sourcePath?: string;
  submitLabel?: string;
};

function sectionHeading(section: CampInquiryFieldDef["section"]): string {
  if (section === "contact") return "ご連絡先";
  if (section === "consult") return "ご希望（日程・ご相談内容）";
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
    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-zinc-500">
      {def.descriptionJa}
    </p>
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
          className="mt-2 min-h-24 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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
          className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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
        className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-brand/20 sm:text-sm"
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

export function CampInquiryForm({
  sourcePath = "/reserve/camp",
  submitLabel = "この内容で問い合わせる",
}: CampInquiryFormProps) {
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
          sourcePath,
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
          "お問い合わせを受け付けました。内容を確認のうえ、運営よりご連絡します。この時点では予約確定ではありません。"
      );
      setValues(emptyCampInquiryFormState());
    } finally {
      setSubmitting(false);
    }
  }

  const bySection = useMemo(() => {
    const contact = CAMP_INQUIRY_PUBLIC_FIELD_DEFS.filter((d) => d.section === "contact");
    const consult = CAMP_INQUIRY_PUBLIC_FIELD_DEFS.filter((d) => d.section === "consult");
    const optional = CAMP_INQUIRY_PUBLIC_FIELD_DEFS.filter((d) => d.section === "optional");
    return { contact, consult, optional };
  }, []);

  if (doneMessage) {
    return (
      <div className="space-y-4 rounded-xl border border-rp-mint-2 bg-rp-mint/70 px-4 py-4 sm:px-5">
        <ReserveHeadingWithIcon
          as="h2"
          shell="navy"
          icon={<IconCheck className="h-5 w-5" strokeWidth={2.25} />}
          textClassName="text-sm font-bold text-rp-navy"
        >
          お問い合わせを受け付けました
        </ReserveHeadingWithIcon>
        <p className="text-sm leading-relaxed text-zinc-800">{doneMessage}</p>
        <p className="text-xs leading-relaxed text-zinc-600">
          開催前のご調整は、運営からの返信にて行います。日帰り交流試合の予約カレンダーとは別のお手続きです。
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 border-t border-dashed border-rp-mint-2 pt-8"
    >
      <section className="space-y-4">
        <ReserveHeadingWithIcon
          as="h2"
          shell="navy"
          icon={<IconClipboard className="h-5 w-5" />}
          textClassName="text-base font-bold text-rp-navy"
        >
          {sectionHeading("contact")}
        </ReserveHeadingWithIcon>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {bySection.contact.map((def) => renderField(def, values[def.id] ?? "", update, submitting))}
        </div>
      </section>

      <section className="space-y-4">
        <ReserveHeadingWithIcon
          as="h2"
          shell="navy"
          icon={<IconTent className="h-5 w-5" />}
          textClassName="text-base font-bold text-rp-navy"
        >
          {sectionHeading("consult")}
        </ReserveHeadingWithIcon>
        <div className="space-y-4">
          {bySection.consult.map((def) => renderField(def, values[def.id] ?? "", update, submitting))}
        </div>
      </section>

      {bySection.optional.length > 0 ? (
        <section className="space-y-4">
          <ReserveHeadingWithIcon
            as="h2"
            shell="navy"
            icon={<IconInfoCircle className="h-5 w-5" />}
            textClassName="text-base font-bold text-rp-navy"
          >
            {sectionHeading("optional")}
          </ReserveHeadingWithIcon>
          <p className="text-xs leading-relaxed text-zinc-500">
            以下は未入力のままで送信できます。
          </p>
          <div className="space-y-4">
            {bySection.optional.map((def) =>
              renderField(def, values[def.id] ?? "", update, submitting)
            )}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rp-brand px-8 text-sm font-semibold text-white shadow-md transition-colors hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400 sm:mx-auto sm:w-auto sm:min-w-[16rem]"
      >
        {submitting ? "送信中…" : submitLabel}
      </button>
    </form>
  );
}
