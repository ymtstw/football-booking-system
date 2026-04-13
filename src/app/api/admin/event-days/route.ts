/** 管理者のみ POST: 開催日 insert ＋ 既定6枠（event_day_slots）insert。 */
import { NextResponse } from "next/server";

import { toEventDaySlotRows } from "@/domains/event-days/default-slots";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

type EventDayStatus =
  | "draft"
  | "open"
  | "locked"
  | "confirmed"
  | "cancelled_weather"
  | "cancelled_minimum";

type CreateBody = {
  eventDate?: string;
  gradeBand?: string;
  reservationDeadlineAt?: string;
  status?: EventDayStatus;
};

function parseCreateBody(body: unknown): CreateBody | null {
  if (body === null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const gradeRaw = o.gradeBand ?? o.grade_band;
  const gradeBand =
    typeof gradeRaw === "string"
      ? gradeRaw
      : typeof gradeRaw === "number"
        ? String(gradeRaw)
        : undefined;
  return {
    eventDate: typeof o.eventDate === "string" ? o.eventDate : undefined,
    gradeBand,
    reservationDeadlineAt:
      typeof o.reservationDeadlineAt === "string"
        ? o.reservationDeadlineAt
        : undefined,
    status: typeof o.status === "string" ? (o.status as EventDayStatus) : undefined,
  };
}

const ALLOWED_STATUS: EventDayStatus[] = [
  "draft",
  "open",
  "locked",
  "confirmed",
  "cancelled_weather",
  "cancelled_minimum",
];

/** YYYY-MM-DD */
function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseCreateBody(json);
  const eventDate = parsed?.eventDate?.trim();
  const gradeBand = parsed?.gradeBand?.trim();
  const reservationDeadlineAt = parsed?.reservationDeadlineAt?.trim();
  const status: EventDayStatus =
    parsed?.status && ALLOWED_STATUS.includes(parsed.status)
      ? parsed.status
      : "draft";

  if (!eventDate || !isIsoDateOnly(eventDate)) {
    return NextResponse.json(
      { error: "eventDate は YYYY-MM-DD 形式で指定してください" },
      { status: 422 }
    );
  }
  if (!gradeBand) {
    return NextResponse.json(
      { error: "gradeBand は必須です" },
      { status: 422 }
    );
  }
  if (!reservationDeadlineAt) {
    return NextResponse.json(
      { error: "reservationDeadlineAt は必須です（ISO 8601 推奨）" },
      { status: 422 }
    );
  }

  const deadline = new Date(reservationDeadlineAt);
  if (Number.isNaN(deadline.getTime())) {
    return NextResponse.json(
      { error: "reservationDeadlineAt が解釈できません" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .insert({
      event_date: eventDate,
      grade_band: gradeBand,
      status,
      reservation_deadline_at: deadline.toISOString(),
    })
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .single();

  if (dayErr) {
    if (dayErr.code === "23505") {
      return NextResponse.json(
        { error: "同じ開催日（event_date）が既に存在します" },
        { status: 409 }
      );
    }
    // service_role なら RLS は通る。ここに来る RLS 系は多くが .env の Secret 誤り。
    const rlsHint =
      dayErr.code === "42501" ||
      /row-level security/i.test(dayErr.message ?? "");
    if (rlsHint) {
      return NextResponse.json(
        {
          error:
            "DB の行レベル制限に引っかかりました。サーバー用の SUPABASE_SERVICE_ROLE_KEY に「Publishable（anon）」を入れていないか確認し、db:status の Secret と NEXT_PUBLIC_SUPABASE_URL を揃えたうえで next dev を再起動してください。",
          code: dayErr.code,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: dayErr.message, code: dayErr.code },
      { status: 500 }
    );
  }

  const slotRows = toEventDaySlotRows(day.id);
  const { error: slotsErr } = await supabase.from("event_day_slots").insert(slotRows);

  if (slotsErr) {
    await supabase.from("event_days").delete().eq("id", day.id);
    const rlsHint =
      slotsErr.code === "42501" ||
      /row-level security/i.test(slotsErr.message ?? "");
    if (rlsHint) {
      return NextResponse.json(
        {
          error:
            "event_day_slots の INSERT が RLS で拒否されました。SUPABASE_SERVICE_ROLE_KEY（Secret）を確認してください。",
          code: slotsErr.code,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: slotsErr.message, code: slotsErr.code },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      eventDay: day,
      slotsInserted: slotRows.length,
    },
    { status: 201 }
  );
}
