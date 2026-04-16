import { NextResponse } from "next/server";

import {
  CAMP_INQUIRY_SCHEMA_VERSION,
  parseCampInquiryAnswers,
} from "@/lib/camp-inquiry/camp-inquiry-field-registry";
import { sendCampInquiryNotifyEmail } from "@/lib/email/camp-inquiry-notify-mail";
import { rateLimitCampInquiryCreate } from "@/lib/rate-limit/camp-inquiry-public";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * 公開 POST: 合宿相談（問い合わせ）。
 * 役割は受付・受入判断材料・事前案内まで。当日運用のシステム化はしない。即時確定しない。認証不要。
 */
export async function POST(request: Request) {
  const limited = rateLimitCampInquiryCreate(request);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const parsed = parseCampInquiryAnswers(json);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldId: parsed.fieldId },
      { status: 422 }
    );
  }

  const sourcePath =
    typeof (json as { sourcePath?: unknown }).sourcePath === "string"
      ? String((json as { sourcePath: string }).sourcePath).slice(0, 500)
      : null;

  const supabase = createServiceRoleClient();
  const insertRow: Record<string, unknown> = {
    schema_version: CAMP_INQUIRY_SCHEMA_VERSION,
    answers: parsed.answers,
    source_path: sourcePath,
    status: "new",
  };

  const { data: row, error } = await supabase
    .from("camp_inquiries")
    .insert(insertRow)
    .select("id, created_at")
    .single();

  if (error || !row?.id) {
    return NextResponse.json(
      { error: error?.message ?? "保存に失敗しました" },
      { status: 500 }
    );
  }

  const inquiryId = row.id as string;
  const createdAtIso = String((row as { created_at?: string }).created_at ?? "");
  void sendCampInquiryNotifyEmail({
    inquiryId,
    createdAtIso,
    answers: parsed.answers,
  });

  return NextResponse.json({
    ok: true,
    inquiryId,
    message:
      "合宿相談を受け付けました。内容を確認のうえ、運営より事前にご連絡します。この時点では予約確定ではありません。開催当日の進行などは各チーム・現場でお願いします。詳細は返信メールにてお願いします。",
  });
}
