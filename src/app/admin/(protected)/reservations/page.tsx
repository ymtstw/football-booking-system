import Link from "next/link";

import { ReservationsDateGetInput } from "@/app/admin/(protected)/reservations/reservations-date-get-input";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import { getNearestUpcomingEventDateIso } from "@/lib/admin/nearest-upcoming-event-date";
import { formatDateTimeTokyoWithWeekday } from "@/lib/dates/format-jp-display";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import { createClient } from "@/lib/supabase/server";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    eventDayId?: string | string[];
    team?: string | string[];
    email?: string | string[];
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawDate = typeof sp.date === "string" ? sp.date.trim() : "";
  const rawEventDayId =
    typeof sp.eventDayId === "string" ? sp.eventDayId.trim() : "";
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

  let dateFromEventDayId: string | null = null;
  if (rawEventDayId && UUID_RE.test(rawEventDayId)) {
    const { data: byId } = await supabase
      .from("event_days")
      .select("event_date")
      .eq("id", rawEventDayId)
      .maybeSingle();
    if (byId?.event_date && isIsoDateOnly(byId.event_date)) {
      dateFromEventDayId = byId.event_date;
    }
  }

  const effectiveDate =
    rawDate && isIsoDateOnly(rawDate)
      ? rawDate
      : dateFromEventDayId ?? fallbackDate;

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
  const hubHref = day && !dayErr ? `/admin/event-days/${day.id}` : null;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">予約一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          開催日を選ぶと、その日の予約とチーム連絡先が表示されます。初期表示は
          <strong className="text-zinc-800"> 今日以降で最も近い開催日</strong>
          です（URL に <code className="rounded bg-zinc-100 px-1 text-xs">eventDayId</code>{" "}
          が付いているときはその開催日に合わせます）。午前枠の付け替え・試合まわりの変更は
          <Link href={preDayHref} className="font-medium text-sky-800 underline underline-offset-2">
            編成を調整
          </Link>
          から行ってください。
        </p>
        {hubHref ? (
          <p className="mt-2">
            <Link
              href={hubHref}
              className="text-sm font-medium text-emerald-800 underline decoration-emerald-600/60 underline-offset-2 hover:text-emerald-950"
            >
              この開催のまとめへ（状況・リンク一覧）
            </Link>
          </p>
        ) : null}
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="block min-w-0 w-full flex-1 text-sm sm:min-w-[12rem]">
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
            <ReservationsDateGetInput
              name="date"
              defaultValue={effectiveDate}
              className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          )}
        </label>
        <label className="block min-w-0 w-full flex-1 text-sm sm:min-w-[10rem]">
          <span className="font-medium text-zinc-800">チーム名（部分一致）</span>
          <input
            name="team"
            type="search"
            defaultValue={typeof sp.team === "string" ? sp.team : ""}
            placeholder="例: 南"
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block min-w-0 w-full flex-1 text-sm sm:min-w-[10rem]">
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
            <span className="font-medium text-zinc-900">開催日の状態:</span>{" "}
            {eventDayStatusLabelJa(day.status)}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-600">
              この条件に該当する予約がありません。
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((r) => {
                  const t = singleTeam(r.teams);
                  if (!t) return null;
                  return (
                    <article
                      key={r.id}
                      className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80"
                    >
                      <dl className="space-y-2.5 text-sm text-zinc-800">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2">
                          <dt className="text-xs font-medium text-zinc-500">開催日</dt>
                          <dd className="font-semibold text-zinc-900">
                            {formatIsoDateWithWeekdayJa(day.event_date)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">チーム名</dt>
                          <dd className="mt-0.5 wrap-break-word font-medium">{t.team_name}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">申込者名</dt>
                          <dd className="mt-0.5 wrap-break-word">{t.contact_name}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">メール</dt>
                          <dd className="mt-0.5 wrap-break-word text-xs sm:text-sm">{t.contact_email}</dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-2">
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">代表学年</dt>
                            <dd className="mt-0.5 tabular-nums">
                              {t.representative_grade_year == null
                                ? "—"
                                : `${t.representative_grade_year}年`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">人数</dt>
                            <dd className="mt-0.5 tabular-nums">{r.participant_count}</dd>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 border-t border-zinc-100 pt-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">予約状態</dt>
                            <dd className="mt-0.5">{reservationStatusLabelJa(r.status)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">作成日時</dt>
                            <dd className="mt-0.5 wrap-break-word text-xs leading-snug">
                              {formatDateTimeTokyoWithWeekday(r.created_at)}
                            </dd>
                          </div>
                        </div>
                      </dl>
                      <div className="mt-4 border-t border-zinc-100 pt-3">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                        >
                          詳細・編集
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden min-w-0 max-w-full md:block">
                <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
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
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
