import Link from "next/link";

import { getNearestUpcomingEventDateIso } from "@/lib/admin/nearest-upcoming-event-date";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createClient } from "@/lib/supabase/server";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateOnly(s: string): boolean {
  if (!DATE_ONLY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

type TeamEmbed = {
  team_name: string;
  contact_name: string;
  contact_email: string;
  representative_grade_year: number | null;
};

type ReservationListRow = {
  id: string;
  status: string;
  participant_count: number;
  created_at: string;
  teams: TeamEmbed | TeamEmbed[] | null;
};

function singleTeam(
  teams: TeamEmbed | TeamEmbed[] | null | undefined
): TeamEmbed | null {
  if (!teams) return null;
  return Array.isArray(teams) ? teams[0] ?? null : teams;
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

/** 管理: 開催日ごとの予約一覧（直近開催日をデフォルト、チーム名・メールで絞り込み） */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string | string[];
    team?: string | string[];
    email?: string | string[];
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawDate = typeof sp.date === "string" ? sp.date.trim() : "";
  const teamQ =
    typeof sp.team === "string" ? sp.team.trim().toLowerCase() : "";
  const emailQ =
    typeof sp.email === "string" ? sp.email.trim().toLowerCase() : "";

  const supabase = await createClient();
  const todayTokyo = tokyoIsoDateToday();
  let fallbackDate = todayTokyo;
  try {
    const nearest = await getNearestUpcomingEventDateIso(supabase, todayTokyo);
    if (nearest) fallbackDate = nearest;
  } catch {
    /* 一覧のみのためフォールバックで続行 */
  }

  const effectiveDate =
    rawDate && isIsoDateOnly(rawDate) ? rawDate : fallbackDate;

  const { data: dateOptions, error: datesErr } = await supabase
    .from("event_days")
    .select("event_date")
    .order("event_date", { ascending: true })
    .limit(400);

  const dateRows = (dateOptions ?? []) as { event_date: string }[];
  const dateChoiceSet = new Set(dateRows.map((r) => r.event_date));
  if (isIsoDateOnly(effectiveDate)) {
    dateChoiceSet.add(effectiveDate);
  }
  const dateChoicesSorted = [...dateChoiceSet].sort();

  const { data: day, error: dayErr } = await supabase
    .from("event_days")
    .select("id, event_date, grade_band, status")
    .eq("event_date", effectiveDate)
    .maybeSingle();

  let rows: ReservationListRow[] = [];
  if (day && !dayErr) {
    const { data: rawList, error: rErr } = await supabase
      .from("reservations")
      .select(
        `
        id,
        status,
        participant_count,
        created_at,
        teams (
          team_name,
          contact_name,
          contact_email,
          representative_grade_year
        )
      `
      )
      .eq("event_day_id", day.id)
      .order("created_at", { ascending: false });

    if (!rErr && rawList) {
      const all = rawList as ReservationListRow[];
      rows = all.filter((r) => {
        const t = singleTeam(r.teams);
        if (!t) return false;
        if (teamQ && !t.team_name.toLowerCase().includes(teamQ)) {
          return false;
        }
        if (emailQ && !t.contact_email.toLowerCase().includes(emailQ)) {
          return false;
        }
        return true;
      });
    }
  }

  const preDayHref = `/admin/pre-day-results?date=${encodeURIComponent(effectiveDate)}&tab=adjust`;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">予約一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          開催日を選ぶと、その日の予約とチーム連絡先が表示されます。初期表示は
          <strong className="text-zinc-800"> 今日以降で最も近い開催日</strong>
          です。午前枠の付け替え・試合まわりの変更は
          <Link href={preDayHref} className="font-medium text-sky-800 underline underline-offset-2">
            前日確定（補正）
          </Link>
          から行ってください。
        </p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="font-medium text-zinc-800">開催日</span>
          {dateChoicesSorted.length > 0 ? (
            <select
              name="date"
              defaultValue={effectiveDate}
              className="mt-1 min-h-10 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {dateChoicesSorted.map((d) => (
                <option key={d} value={d}>
                  {formatIsoDateWithWeekdayJa(d)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              name="date"
              defaultValue={effectiveDate}
              className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          )}
        </label>
        <label className="block min-w-[10rem] flex-1 text-sm">
          <span className="font-medium text-zinc-800">チーム名（部分一致）</span>
          <input
            name="team"
            type="search"
            defaultValue={typeof sp.team === "string" ? sp.team : ""}
            placeholder="例: 南"
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block min-w-[10rem] flex-1 text-sm">
          <span className="font-medium text-zinc-800">メール（部分一致）</span>
          <input
            name="email"
            type="search"
            defaultValue={typeof sp.email === "string" ? sp.email : ""}
            placeholder="例: @gmail"
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            絞り込み
          </button>
          <Link
            href="/admin/reservations"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            条件クリア
          </Link>
        </div>
      </form>

      {datesErr ? (
        <p className="text-sm text-red-600">開催日一覧の取得に失敗しました。</p>
      ) : null}
      {dayErr ? (
        <p className="text-sm text-red-600">開催日の取得に失敗しました。</p>
      ) : !day ? (
        <p className="text-sm text-zinc-600">
          選択した日付に開催日がありません。上の開催日を変更してください。
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">開催の学年帯:</span>{" "}
            {day.grade_band}
            <span className="mx-2 text-zinc-400">|</span>
            <span className="font-medium text-zinc-900">開催日状態:</span>{" "}
            {day.status}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-600">
              この条件に該当する予約がありません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-[56rem] w-full border-collapse text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 sm:text-sm">
                  <tr>
                    <th className="px-3 py-2.5 sm:px-4">開催日</th>
                    <th className="px-3 py-2.5 sm:px-4">チーム名</th>
                    <th className="px-3 py-2.5 sm:px-4">申込者名</th>
                    <th className="px-3 py-2.5 sm:px-4">メール</th>
                    <th className="px-3 py-2.5 sm:px-4">代表学年</th>
                    <th className="px-3 py-2.5 sm:px-4">人数</th>
                    <th className="px-3 py-2.5 sm:px-4">予約状態</th>
                    <th className="px-3 py-2.5 sm:px-4">作成日時</th>
                    <th className="px-3 py-2.5 sm:px-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => {
                    const t = singleTeam(r.teams);
                    if (!t) return null;
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                          {formatIsoDateWithWeekdayJa(day.event_date)}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-2.5 sm:px-4">
                          {t.team_name}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2.5 sm:px-4">
                          {t.contact_name}
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                          {t.contact_email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                          {t.representative_grade_year == null
                            ? "—"
                            : `${t.representative_grade_year}年`}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4">{r.participant_count}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                          {reservationStatusLabelJa(r.status)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                          {formatDateTimeTokyoWithWeekday(r.created_at)}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4">
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            className="font-medium text-sky-800 underline underline-offset-2"
                          >
                            詳細・編集
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
