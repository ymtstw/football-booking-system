import { NextResponse } from "next/server";

import { sendTournamentInquiryNotifyEmail } from "@/lib/email/tournament-inquiry-notify-mail";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_WRITE_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { rateLimitTournamentInquiryCreate } from "@/lib/rate-limit/tournament-inquiry-public";
import { createServiceRoleClient } from "@/lib/supabase/service";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 8000;
const MAX_NAME = 200;
const MAX_PHONE = 30;

const GENERIC_422 =
  "お名前・有効なメールアドレス・メール確認・電話番号・お問い合わせ内容を入力してください";

type ParsedTournamentBody =
  | {
      ok: true;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      message: string;
      sourcePath: string | null;
    }
  | { ok: false; error: string; fieldId?: string };

function parseBody(raw: unknown): ParsedTournamentBody {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, error: "JSON オブジェクトで送信してください" };
  }
  const o = raw as Record<string, unknown>;
  const contactName =
    typeof o.contactName === "string"
      ? o.contactName.trim()
      : typeof o.name === "string"
        ? o.name.trim()
        : "";
  const contactEmail =
    typeof o.contactEmail === "string"
      ? o.contactEmail.trim().toLowerCase()
      : typeof o.email === "string"
        ? o.email.trim().toLowerCase()
        : "";
  const contactEmailConfirm =
    typeof o.contactEmailConfirm === "string"
      ? o.contactEmailConfirm.trim().toLowerCase()
      : typeof o.emailConfirm === "string"
        ? o.emailConfirm.trim().toLowerCase()
        : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const contactPhoneRaw =
    typeof o.contactPhone === "string"
      ? o.contactPhone.trim()
      : typeof o.phone === "string"
        ? o.phone.trim()
        : "";
  const contactPhone = contactPhoneRaw.slice(0, MAX_PHONE);
  const sourcePath =
    typeof o.sourcePath === "string"
      ? o.sourcePath.slice(0, 500)
      : null;

  if (!contactName || contactName.length > MAX_NAME) {
    return { ok: false, error: GENERIC_422 };
  }
  if (!contactEmail || !SIMPLE_EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: GENERIC_422 };
  }
  if (!contactEmailConfirm) {
    return {
      ok: false,
      error: "メールアドレス（確認）を入力してください",
      fieldId: "contactEmailConfirm",
    };
  }
  if (contactEmailConfirm !== contactEmail) {
    return {
      ok: false,
      error: "メールアドレスが一致しません。同じ内容を2回入力してください。",
      fieldId: "contactEmailConfirm",
    };
  }
  if (!contactPhone) {
    return { ok: false, error: GENERIC_422 };
  }
  if (!message || message.length > MAX_MESSAGE) {
    return { ok: false, error: GENERIC_422 };
  }

  return {
    ok: true,
    contactName,
    contactEmail,
    contactPhone,
    message,
    sourcePath,
  };
}

/**
 * 公開 POST: 大会・サイト一般のお問い合わせ（認証不要）。
 */
export async function POST(request: Request) {
  const limited = rateLimitTournamentInquiryCreate(request);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const parsed = parseBody(json);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldId: parsed.fieldId },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("tournament_inquiries")
    .insert({
      contact_name: parsed.contactName,
      contact_email: parsed.contactEmail,
      contact_phone: parsed.contactPhone,
      message: parsed.message,
      source_path: parsed.sourcePath,
      status: "new",
    })
    .select("id, created_at")
    .single();

  if (error || !row?.id) {
    if (error) {
      logPublicReserveApiSupabaseError("POST /api/tournament-inquiries insert", error);
    }
    return NextResponse.json(
      { error: PUBLIC_RESERVE_API_WRITE_ERROR_JA, code: error?.code },
      { status: 500 }
    );
  }

  const inquiryId = row.id as string;
  const createdAtIso = String((row as { created_at?: string }).created_at ?? "");

  void sendTournamentInquiryNotifyEmail({
    inquiryId,
    createdAtIso,
    contactName: parsed.contactName,
    contactEmail: parsed.contactEmail,
    contactPhone: parsed.contactPhone,
    message: parsed.message,
  });

  return NextResponse.json({
    ok: true,
    inquiryId,
    message:
      "お問い合わせを受け付けました。内容を確認のうえ、必要に応じてご連絡します。",
  });
}
