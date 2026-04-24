/** 有効な予約が残っている場合の枠の強制変更（別確認 UI）。 */
import { notFound, redirect } from "next/navigation";

import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { createClient } from "@/lib/supabase/server";

import { EventDayOpsBreadcrumb } from "../../../event-day-ops-breadcrumb";
import { eventDayStatusLabelJa } from "../../../event-day-status-label";
import { SlotsForcePageClient } from "../slots-force-client";

export default async function AdminEventDaySlotsForcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: day, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, reservation_deadline_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !day) {
    notFound();
  }

  const statusAllows =
    day.status === "draft" || day.status === "open";
  if (!statusAllows) {
    notFound();
  }

  const { count, error: cErr } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("event_day_id", id)
    .eq("status", "active");
  if (cErr) {
    throw new Error(cErr.message);
  }
  const activeReservationCount = count ?? 0;
  if (activeReservationCount === 0) {
    redirect(`/admin/event-days/${id}/slots`);
  }

  const { data: slots, error: sErr } = await supabase
    .from("event_day_slots")
    .select(
      "id, slot_code, phase, start_time, end_time, capacity, is_active, is_time_changed, is_locked"
    )
    .eq("event_day_id", id)
    .order("start_time", { ascending: true });
  if (sErr) {
    throw new Error(sErr.message);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <EventDayOpsBreadcrumb
          eventDayId={id}
          items={[
            { href: `/admin/event-days/${id}/slots`, label: "枠・時刻設定" },
            { label: "枠の強制変更" },
          ]}
        />
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">
          枠の強制変更
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          <span className="font-medium text-zinc-800">
            {formatIsoDateWithWeekdayJa(day.event_date)}
          </span>
          <span className="mx-1.5 text-zinc-400">·</span>
          <span>{day.grade_band}</span>
          <span className="mx-1.5 text-zinc-400">·</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
            {eventDayStatusLabelJa(day.status)}
          </span>
        </p>
      </div>

      <SlotsForcePageClient
        eventDayId={id}
        initialSlots={slots ?? []}
        activeReservationCount={activeReservationCount}
        reservationDeadlineAt={String(day.reservation_deadline_at ?? "")}
      />
    </div>
  );
}
