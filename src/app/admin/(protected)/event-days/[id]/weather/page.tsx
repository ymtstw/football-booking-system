import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
    .select("id, event_date, grade_band, status, weather_status")
    .eq("id", id)
    .maybeSingle();

  if (error || !eventDay) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="mb-4 text-sm text-zinc-600">
        <Link
          href="/admin/event-days"
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          開催日一覧
        </Link>
        {" · "}
        <Link
          href={`/admin/event-days/${id}/slots`}
          className="font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2"
        >
          枠・時刻
        </Link>
      </p>
      <h1 className="mb-2 text-lg font-semibold text-zinc-900">雨天判断</h1>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600">
        事前に go / cancel を登録できます。原則、参加者向けの最終文面は{" "}
        <strong>前日 13:30</strong> の一括メール（JOB03）に反映されます。荒天など例外的に早く伝える必要があるときだけ、中止登録と同時に
        「即時送信」を選べます。
      </p>
      <WeatherDecisionForm eventDay={eventDay} />
    </div>
  );
}
