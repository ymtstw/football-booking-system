/**
 * 合宿「日程相談」フォームの項目定義（単一ソース）。
 * MVP では合宿の当日運用・進行管理・合宿専用対戦表は扱わず、受付と事前案内に必要な入力に留める。
 * 追加・削除・必須切替・表示順はこの配列の並びと各フィールドのプロパティで調整する。
 * 宿泊プランの選択肢は `camp-lodging-plans.ts` から注入する（ベタ書き分散を避ける）。
 */

import {
  getLodgingPlanLabelJa,
  getLodgingPlanSelectOptions,
  isActiveLodgingPlanId,
} from "@/lib/camp-inquiry/camp-lodging-plans";

/** DB に保存するスキーマ世代（answers の解釈に使用） */
export const CAMP_INQUIRY_SCHEMA_VERSION = "v5" as const;

export type CampInquiryFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "number";

export type CampInquiryFieldOption = {
  value: string;
  labelJa: string;
};

/** 画面セクション（見出し用） */
export type CampInquiryFieldSection = "contact" | "consult" | "optional";

export type CampInquiryFieldDef = {
  id: string;
  section: CampInquiryFieldSection;
  labelJa: string;
  descriptionJa?: string;
  type: CampInquiryFieldType;
  required: boolean;
  placeholderJa?: string;
  options?: readonly CampInquiryFieldOption[];
  maxLength?: number;
  rows?: number;
  numberMin?: number;
  /**
   * true のとき公開フォームでは出さない（値は空で送信可。プラン選択など将来再利用用に定義だけ残す）
   */
  hiddenFromPublicForm?: boolean;
};

function buildCampInquiryFieldDefs(): readonly CampInquiryFieldDef[] {
  const planOptions = getLodgingPlanSelectOptions();

  return [
    {
      id: "contact_name",
      section: "contact",
      labelJa: "代表者名",
      type: "text",
      required: true,
      maxLength: 80,
      placeholderJa: "例：山田 太郎",
    },
    {
      id: "team_name",
      section: "contact",
      labelJa: "所属チーム名",
      type: "text",
      required: true,
      maxLength: 120,
      placeholderJa: "例：○○サッカークラブ",
    },
    {
      id: "contact_email",
      section: "contact",
      labelJa: "メールアドレス",
      type: "email",
      required: true,
      maxLength: 254,
      placeholderJa: "ご返信用のメールアドレス",
    },
    {
      id: "contact_phone",
      section: "contact",
      labelJa: "電話番号",
      type: "tel",
      required: true,
      maxLength: 30,
      placeholderJa: "ハイフンありでも可",
    },
    {
      id: "preferred_plan",
      section: "consult",
      labelJa: "希望プラン",
      descriptionJa: "案内ページの宿泊プランからお選びください。",
      type: "select",
      required: false,
      options: planOptions,
      hiddenFromPublicForm: true,
    },
    {
      id: "preferred_dates",
      section: "consult",
      labelJa: "希望日程",
      descriptionJa:
        "複数候補でも構いませんので、できるだけ具体的な日付でご記入ください。\n例：8月17日〜18日、8月22日から1泊2日 など\n日程がまだ決まっていない場合は、その旨をご記入ください。",
      type: "textarea",
      required: true,
      maxLength: 2000,
      rows: 3,
      placeholderJa:
        "例：8月17日〜18日／8月22日から1泊2日を検討中／8月24日・25日のいずれかを希望",
    },
    {
      id: "headcount",
      section: "consult",
      labelJa: "参加予定人数（概算）",
      descriptionJa:
        "人数の目安や「未定」「10名前後」など、わかる範囲で構いません。",
      type: "text",
      required: false,
      maxLength: 120,
      placeholderJa: "例: 15名程度、未定、など",
      hiddenFromPublicForm: true,
    },
    {
      id: "inquiry_message",
      section: "consult",
      labelJa: "ご相談内容",
      descriptionJa:
        "宿泊に関するご希望をご記入ください。\n参加予定人数・チーム数・泊数・希望日など、分かる範囲でご記載ください。",
      type: "textarea",
      required: true,
      maxLength: 4000,
      rows: 5,
      placeholderJa:
        "例：8月22日から1泊2日を検討中です。\n2チーム、30名程度を予定しています。\n宿泊を含めた合宿の相談をしたいです。",
    },
    {
      id: "grade_band_note",
      section: "optional",
      labelJa: "学年帯（任意）",
      type: "text",
      required: false,
      maxLength: 200,
      placeholderJa: "例: 小学3〜4年中心（未定でも可）",
      hiddenFromPublicForm: true,
    },
    {
      id: "match_preference",
      section: "optional",
      labelJa: "対戦希望（任意）",
      type: "textarea",
      required: false,
      maxLength: 2000,
      rows: 3,
      hiddenFromPublicForm: true,
    },
    {
      id: "supplementary",
      section: "optional",
      labelJa: "補足事項（任意）",
      type: "textarea",
      required: false,
      maxLength: 2000,
      rows: 3,
      hiddenFromPublicForm: true,
    },
  ];
}

/** 表示順＝配列順（プラン選択肢は起動時点の `camp-lodging-plans` 反映） */
export const CAMP_INQUIRY_FIELD_DEFS: readonly CampInquiryFieldDef[] =
  buildCampInquiryFieldDefs();

/** 公開フォームに出す項目（将来用に `hiddenFromPublicForm` の定義だけ残している項目は除く） */
export const CAMP_INQUIRY_PUBLIC_FIELD_DEFS: readonly CampInquiryFieldDef[] =
  CAMP_INQUIRY_FIELD_DEFS.filter((d) => !d.hiddenFromPublicForm);

const SIMPLE_EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** フォーム送信 JSON から answers を検証し、正規化した文字列レコードを返す */
export function parseCampInquiryAnswers(body: unknown): {
  ok: true;
  answers: Record<string, string>;
} | {
  ok: false;
  error: string;
  fieldId?: string;
} {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "JSON オブジェクトで送信してください" };
  }
  const rawAnswers = (body as { answers?: unknown }).answers;
  if (rawAnswers === null || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    return { ok: false, error: "answers オブジェクトが必要です" };
  }

  const out: Record<string, string> = {};
  const allowedIds = new Set(CAMP_INQUIRY_FIELD_DEFS.map((d) => d.id));

  for (const def of CAMP_INQUIRY_FIELD_DEFS) {
    const raw = (rawAnswers as Record<string, unknown>)[def.id];
    let s: string;

    if (def.type === "number") {
      const n =
        typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : typeof raw === "string" && raw.trim() !== ""
            ? Number(raw.trim())
            : NaN;
      if (def.required && (!Number.isInteger(n) || n < (def.numberMin ?? 0))) {
        return {
          ok: false,
          error: `${def.labelJa}は${def.numberMin ?? 0}以上の整数で入力してください`,
          fieldId: def.id,
        };
      }
      if (!def.required && (raw === "" || raw === undefined || raw === null)) {
        s = "";
      } else if (!Number.isInteger(n) || n < (def.numberMin ?? 0)) {
        return {
          ok: false,
          error: `${def.labelJa}は${def.numberMin ?? 0}以上の整数で入力してください`,
          fieldId: def.id,
        };
      } else {
        s = String(n);
      }
    } else {
      s = trimStr(raw);
      if (def.maxLength != null && s.length > def.maxLength) {
        return {
          ok: false,
          error: `${def.labelJa}は${def.maxLength}文字以内で入力してください`,
          fieldId: def.id,
        };
      }
      if (def.required && s === "") {
        return { ok: false, error: `${def.labelJa}は必須です`, fieldId: def.id };
      }
      if (def.type === "email" && s !== "" && !SIMPLE_EMAIL_RE.test(s)) {
        return { ok: false, error: "メールアドレスの形式が不正です", fieldId: def.id };
      }
      if (def.type === "select") {
        if (def.id === "preferred_plan") {
          if (def.required && (s === "" || !isActiveLodgingPlanId(s))) {
            return { ok: false, error: "希望プランを選択してください", fieldId: def.id };
          }
          if (!def.required && s !== "" && !isActiveLodgingPlanId(s)) {
            return { ok: false, error: "希望プランの選択が不正です", fieldId: def.id };
          }
        } else {
          const allowed = new Set((def.options ?? []).map((o) => o.value));
          if (def.required && (s === "" || !allowed.has(s))) {
            return { ok: false, error: `${def.labelJa}を選択してください`, fieldId: def.id };
          }
          if (!def.required && s !== "" && !allowed.has(s)) {
            return { ok: false, error: `${def.labelJa}の選択が不正です`, fieldId: def.id };
          }
        }
      }
    }

    if (s !== "") {
      out[def.id] = s;
    }
  }

  for (const key of Object.keys(rawAnswers as object)) {
    if (!allowedIds.has(key)) {
      // 未知キーは無視
    }
  }

  return { ok: true, answers: out };
}

/** フォーム初期状態（全フィールドを空文字） */
export function emptyCampInquiryFormState(): Record<string, string> {
  return Object.fromEntries(CAMP_INQUIRY_FIELD_DEFS.map((d) => [d.id, ""]));
}

/** メール・管理画面用: 項目ラベル付きの行一覧（レジストリ外のキーは末尾にそのまま表示） */
export function formatCampInquiryAnswersForDisplay(
  answers: Record<string, string>
): { labelJa: string; value: string }[] {
  const lines: { labelJa: string; value: string }[] = [];
  const known = new Set(CAMP_INQUIRY_FIELD_DEFS.map((d) => d.id));

  for (const def of CAMP_INQUIRY_FIELD_DEFS) {
    const v = answers[def.id];
    if (v == null || v === "") continue;
    if (def.id === "preferred_plan") {
      lines.push({
        labelJa: def.labelJa,
        value: getLodgingPlanLabelJa(v) ?? v,
      });
      continue;
    }
    if (def.type === "select" && def.options) {
      const opt = def.options.find((o) => o.value === v);
      lines.push({ labelJa: def.labelJa, value: opt?.labelJa ?? v });
    } else {
      lines.push({ labelJa: def.labelJa, value: v });
    }
  }

  for (const [k, v] of Object.entries(answers)) {
    if (known.has(k) || v == null || v === "") continue;
    lines.push({ labelJa: `（旧項目・その他） ${k}`, value: v });
  }

  return lines;
}
