import Link from "next/link";
import { notFound } from "next/navigation";

import { ReservationDetailEditClient } from "../reservation-detail-edit-client";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TeamRow = {
  id: string;
  team_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  strength_category: "strong" | "potential";
  representative_grade_year: number | null;
};

type EventDayRow = {
  event_date: string;
  grade_band: string;
  status: string;
};

type ReservationRow = {
  id: string;
  event_day_id: string;
  status: string;
  participant_count: number;
  remarks: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  selected_morning_slot_id: string | null;
  teams: TeamRow | TeamRow[] | null;
};

function single<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

function reservationStatusLabelJa(s: string): string {
  switch (s) {
    case "active":
      return "有効";
    case "cancelled":
      return "取消済み";
    default:
      return s;
  }
}

/** 管理: 予約詳細（読み取り＋チーム・予約情報の編集） */
export default async function AdminReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      event_day_id,
      status,
      participant_count,
      remarks,
      display_name,
      created_at,
      updated_at,
      selected_morning_slot_id,
      teams (
        id,
        team_name,
        contact_name,
        contact_email,
        contact_phone,
        strength_category,
        representative_grade_year
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const row = data as ReservationRow;
  const team = single(row.teams);
  if (!team) {
    notFound();
  }

  const { data: dayRow, error: dayErr } = await supabase
    .from("event_days")
    .select("event_date, grade_band, status")
    .eq("id", row.event_day_id)
    .maybeSingle();

  if (dayErr || !dayRow) {
    notFound();
  }
  const day = dayRow as EventDayRow;

  let morningSlotLabel = "—";
  if (row.selected_morning_slot_id) {
    const { data: slot } = await supabase
      .from("event_day_slots")
      .select("slot_code, start_time, end_time")
      .eq("id", row.selected_morning_slot_id)
      .maybeSingle();
    if (slot) {
      const st = String(slot.start_time ?? "").slice(0, 5);
      const et = String(slot.end_time ?? "").slice(0, 5);
      morningSlotLabel = `${slot.slot_code}（${st}〜${et}）`;
    }
  }

  const preDayHref = `/admin/pre-day-results?date=${encodeURIComponent(day.event_date)}&tab=adjust`;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <Link
          href={`/admin/reservations?date=${encodeURIComponent(day.event_date)}`}
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          ← この開催日の一覧へ
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">予約詳細</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 sm:text-sm">{row.id}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-800">
        <p>
          枠・試合の変更は{" "}
          <Link href={preDayHref} className="font-medium text-sky-800 underline underline-offset-2">
            前日確定（補正タブ）
          </Link>
          または試合一覧の運用へ。
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">読み取り専用</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">開催日</dt>
            <dd>{formatIsoDateWithWeekdayJa(day.event_date)}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">開催の学年帯</dt>
            <dd>{day.grade_band}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">開催日ステータス</dt>
            <dd>{day.status}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">午前枠（選択中）</dt>
            <dd>{morningSlotLabel}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">予約状態</dt>
            <dd>{reservationStatusLabelJa(row.status)}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">作成日時</dt>
            <dd>{formatDateTimeTokyoWithWeekday(row.created_at)}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-zinc-500">更新日時</dt>
            <dd>{formatDateTimeTokyoWithWeekday(row.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <ReservationDetailEditClient
        reservationId={row.id}
        initial={{
          participant_count: row.participant_count,
          remarks: row.remarks ?? "",
          display_name: row.display_name ?? "",
          team_name: team.team_name,
          contact_name: team.contact_name,
          contact_email: team.contact_email,
          contact_phone: team.contact_phone,
          strength_category: team.strength_category,
          representative_grade_year: team.representative_grade_year,
        }}
      />
    </div>
  );
}
