import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { EventDayOpsBreadcrumb } from "../../event-day-ops-breadcrumb";
import { WeatherDecisionForm } from "./weather-decision-form";

export default async function AdminEventDayWeatherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: eventDay, error } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status, weather_status, status_before_weather_cancel")
    .eq("id", id)
    .maybeSingle();

  if (error || !eventDay) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <EventDayOpsBreadcrumb
        eventDayId={id}
        items={[
          { href: `/admin/event-days/${id}/slots`, label: "枠・時刻" },
          { label: "雨天判断" },
        ]}
      />
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">雨天判断</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        事前に go / cancel を登録できます。原則、参加者向けの最終文面は{" "}
        <strong>前日の一括メール（16:30頃開始・参加者向け目安は17:30まで）</strong>
        に反映されます。荒天など例外的に早く伝える必要があるときは、中止で「即時確定＋即時メール」または「前日一括で雨天中止文面を送る予約
        （day_before_17）」を選べます。
        <span className="mt-2 block text-xs text-zinc-500">
          天候以外の中止は{" "}
          <Link
            href={`/admin/event-days/${id}/operational-cancel`}
            className="font-medium text-rose-800 underline decoration-rose-600/60 underline-offset-2"
          >
            緊急中止（運営）
          </Link>{" "}
          から登録してください。
        </span>
      </p>
      {eventDay.status === "cancelled_minimum" || eventDay.status === "cancelled_operational" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          {eventDay.status === "cancelled_minimum"
            ? "最少催行中止のため、雨天判断は登録できません。"
            : "運営都合中止のため、雨天判断は登録できません。"}
        </p>
      ) : (
        <WeatherDecisionForm
          eventDay={{
            id: eventDay.id,
            event_date: eventDay.event_date,
            grade_band: eventDay.grade_band,
            status: eventDay.status as string,
            weather_status: eventDay.weather_status as string | null,
            status_before_weather_cancel:
              (eventDay as { status_before_weather_cancel?: string | null })
                .status_before_weather_cancel ?? null,
          }}
        />
      )}
    </div>
  );
}
