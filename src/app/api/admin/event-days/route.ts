/** 管理者のみ POST: 開催日 insert ＋ 既定枠（`default-slots` の件数ぶん `event_day_slots`）insert。 */
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  isDefaultSlotPreset,
  toEventDaySlotRows,
  type DefaultSlotPreset,
} from "@/domains/event-days/default-slots";
import { EVENT_DAYS_TAG } from "@/lib/admin/event-days-cache";
import { getAdminUser } from "@/lib/auth/require-admin";
import {
  ADMIN_API_SAVE_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst } from "@/lib/dates/reservation-deadline-default";
import { assertEventDayAcceptsBookableLunchMenus } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import { createServiceRoleClient } from "@/lib/supabase/service";

type EventDayStatus =
  | "draft"
  | "open"
  | "locked"
  | "confirmed"
  | "cancelled_weather"
  | "cancelled_operational"
  | "cancelled_minimum";

type CreateBody = {
  eventDate?: string;
  gradeBand?: string;
  reservationDeadlineAt?: string;
  status?: EventDayStatus;
  defaultSlotPreset?: DefaultSlotPreset;
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
  const presetRaw = o.defaultSlotPreset;
  const defaultSlotPreset =
    presetRaw !== undefined && isDefaultSlotPreset(presetRaw) ? presetRaw : undefined;

  return {
    eventDate: typeof o.eventDate === "string" ? o.eventDate : undefined,
    gradeBand,
    reservationDeadlineAt:
      typeof o.reservationDeadlineAt === "string"
        ? o.reservationDeadlineAt
        : undefined,
    status: typeof o.status === "string" ? (o.status as EventDayStatus) : undefined,
    defaultSlotPreset,
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
  const status: EventDayStatus =
    parsed?.status && ALLOWED_STATUS.includes(parsed.status)
      ? parsed.status
      : "draft";
  const slotPreset: DefaultSlotPreset = parsed?.defaultSlotPreset ?? "six";

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

  /** 締切は Cron・案内メールの前提に合わせ、作成時は標準のみ（クライアント指定は使わない）。 */
  const canonicalDeadlineIso =
    defaultReservationDeadlineAtIsoTwoDaysBefore1500Jst(eventDate);
  const deadlineMs = new Date(canonicalDeadlineIso).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return NextResponse.json(
      { error: "開催日から予約締切を算出できません" },
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
      reservation_deadline_at: new Date(deadlineMs).toISOString(),
    })
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .single();

  if (dayErr) {
    if (dayErr.code === "23505") {
      return NextResponse.json(
        { error: "同じ開催日が既に存在します" },
        { status: 409 }
      );
    }
    // service_role なら RLS は通る。ここに来る RLS 系は多くが .env の Secret 誤り。
    const rlsHint =
      dayErr.code === "42501" ||
      /row-level security/i.test(dayErr.message ?? "");
    if (rlsHint) {
      logAdminApiDbError("POST event-days INSERT RLS or policy", dayErr);
      return NextResponse.json(
        {
          error:
            "DB の行レベル制限に引っかかりました。サーバー用の SUPABASE_SECRET_KEY に NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（Publishable）を入れていないか確認し、db:status の Secret と NEXT_PUBLIC_SUPABASE_URL を揃えたうえで next dev を再起動してください。",
        },
        { status: 503 }
      );
    }
    logAdminApiDbError("POST event-days INSERT", dayErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  const slotRows = toEventDaySlotRows(day.id, slotPreset);
  const { error: slotsErr } = await supabase.from("event_day_slots").insert(slotRows);

  if (slotsErr) {
    await supabase.from("event_days").delete().eq("id", day.id);
    const rlsHint =
      slotsErr.code === "42501" ||
      /row-level security/i.test(slotsErr.message ?? "");
    if (rlsHint) {
      logAdminApiDbError("POST event-days event_day_slots INSERT RLS", slotsErr);
      return NextResponse.json(
        {
          error:
            "event_day_slots の INSERT が RLS で拒否されました。SUPABASE_SECRET_KEY（Secret）を確認してください。",
        },
        { status: 503 }
      );
    }
    logAdminApiDbError("POST event-days event_day_slots INSERT", slotsErr);
    return NextResponse.json({ error: ADMIN_API_SAVE_ERROR_JA }, { status: 500 });
  }

  if (status === "open") {
    const lunch = await assertEventDayAcceptsBookableLunchMenus(supabase, day.id);
    if (!lunch.ok) {
      await supabase.from("event_days").delete().eq("id", day.id);
      return NextResponse.json({ error: lunch.message }, { status: 422 });
    }
  }

  // 開催日一覧のカレンダー・日付選択キャッシュを無効化
  revalidateTag(EVENT_DAYS_TAG, "max");

  return NextResponse.json(
    {
      eventDay: day,
      slotsInserted: slotRows.length,
    },
    { status: 201 }
  );
}
