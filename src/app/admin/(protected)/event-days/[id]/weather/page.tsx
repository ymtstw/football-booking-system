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
    .select(
      "id, event_date, grade_band, status, weather_status, status_before_weather_cancel, final_day_before_notice_completed_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !eventDay) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <EventDayOpsBreadcrumb eventDayId={id} items={[{ label: "天候対応" }]} />
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">天候対応</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        実施／中止を登録します。雨天で中止にするときの連絡は次の2通りです。{" "}
        <strong>① 開催前日に自動で一斉送信</strong>（16:30頃）／{" "}
        <strong>② 登録と同時にメール送信</strong>（緊急時）。
        <br />
        送信状況により、到着まで数分程度かかる場合があります。
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
            ? "最少催行未達で中止のため、天候対応は登録できません。"
            : "運営都合で中止のため、天候対応は登録できません。"}
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
            final_day_before_notice_completed_at:
              (eventDay as { final_day_before_notice_completed_at?: string | null })
                .final_day_before_notice_completed_at ?? null,
          }}
        />
      )}
    </div>
  );
}
