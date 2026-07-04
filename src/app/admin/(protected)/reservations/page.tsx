import Link from "next/link";

import { ReservationsDateGetInput } from "@/app/admin/(protected)/reservations/reservations-date-get-input";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import { ReservationStatusBadge } from "@/components/admin/reservation-status-badge";
import { getEventDaysDateOptionsCached } from "@/lib/admin/event-days-cache";
import { getNearestUpcomingEventDateIso } from "@/lib/admin/nearest-upcoming-event-date";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { tokyoIsoDateToday } from "@/lib/dates/tokyo-calendar-grid";
import {
  escapeForPostgresIlikeFragment,
  formatReservationPublicRefForDisplay,
} from "@/lib/reservations/public-ref";
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
  public_ref: string | null;
  teams: TeamEmbed | TeamEmbed[] | null;
};

type RefLookupHit = {
  id: string;
  public_ref: string;
  event_days: { event_date: string } | { event_date: string }[] | null;
  teams: TeamEmbed | TeamEmbed[] | null;
};

/** 一覧ヘッダ用（event_days を id / 日付のどちらでも1回で揃える） */
type EventDayHeaderRow = {
  id: string;
  event_date: string;
  grade_band: string;
  status: string;
};

function eventDateFromReservationJoin(
  ev: RefLookupHit["event_days"]
): string | null {
  if (!ev) return null;
  const first = Array.isArray(ev) ? ev[0] : ev;
  return first?.event_date ?? null;
}

function singleTeam(
  teams: TeamEmbed | TeamEmbed[] | null | undefined
): TeamEmbed | null {
  if (!teams) return null;
  return Array.isArray(teams) ? teams[0] ?? null : teams;
}

/** 一覧上部フォーム用（縦を詰める） */
const inputClass =
  "mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm";

/** 管理: 開催日ごとの予約一覧（直近開催日をデフォルト、チーム名・メール・予約番号で絞り込み） */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string | string[];
    eventDayId?: string | string[];
    team?: string | string[];
    email?: string | string[];
    ref?: string | string[];
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
  const refRaw = typeof sp.ref === "string" ? sp.ref.trim() : "";

  const supabase = await createClient();
  const todayTokyo = tokyoIsoDateToday();

  const hasValidDateParam = Boolean(rawDate && isIsoDateOnly(rawDate));
  const hasEventDayIdParam = Boolean(rawEventDayId && UUID_RE.test(rawEventDayId));
  /**
   * `date` が有効なときだけ「直近開催」を省略（往復削減）。
   * `eventDayId` だけでは削除済み ID などで日付が取れないことがあり、その場合は従来どおり直近開催へフォールバックする必要があるため省略しない。
   */
  const skipNearest = hasValidDateParam;

  const nearestPromise: Promise<string | null> = skipNearest
    ? Promise.resolve(null)
    : getNearestUpcomingEventDateIso(supabase, todayTokyo).catch(() => null);

  // 日付ドロップダウンは全管理者共通なのでキャッシュ版（60秒）を使い Disk IO を抑える
  const dateOptionsPromise = getEventDaysDateOptionsCached();

  const eventDayByIdPromise = hasEventDayIdParam
    ? supabase
        .from("event_days")
        .select("id, event_date, grade_band, status")
        .eq("id", rawEventDayId)
        .maybeSingle()
    : Promise.resolve({ data: null as EventDayHeaderRow | null, error: null });

  const refHitsPromise =
    refRaw.length > 0
      ? supabase
          .from("reservations")
          .select(
            `
        id,
        public_ref,
        event_days ( event_date ),
        teams ( team_name )
      `
          )
          .ilike("public_ref", `%${escapeForPostgresIlikeFragment(refRaw)}%`)
          .limit(30)
      : Promise.resolve({ data: [] as unknown[], error: null });

  const [nearest, dateOptsRes, byIdRes, refRes] = await Promise.all([
    nearestPromise,
    dateOptionsPromise,
    eventDayByIdPromise,
    refHitsPromise,
  ]);

  let fallbackDate = todayTokyo;
  if (!skipNearest && nearest) {
    fallbackDate = nearest;
  }

  const byIdRow =
    hasEventDayIdParam && !byIdRes.error
      ? (byIdRes.data as EventDayHeaderRow | null)
      : null;

  let dateFromEventDayId: string | null = null;
  if (byIdRow?.event_date && isIsoDateOnly(byIdRow.event_date)) {
    dateFromEventDayId = byIdRow.event_date;
  }

  let effectiveDate =
    rawDate && isIsoDateOnly(rawDate)
      ? rawDate
      : dateFromEventDayId ?? fallbackDate;

  let refSingleReservationId: string | null = null;
  let refLookupNotFound = false;
  let refLookupMulti: Array<{
    id: string;
    public_ref: string;
    event_date: string;
    team_name: string;
  }> = [];

  if (refRaw) {
    const refHits = (refRes.data ?? []) as RefLookupHit[];
    if (refHits.length === 0) {
      refLookupNotFound = true;
    } else if (refHits.length === 1) {
      const d0 = eventDateFromReservationJoin(refHits[0]!.event_days);
      if (d0 && isIsoDateOnly(d0)) {
        effectiveDate = d0;
      }
      refSingleReservationId = refHits[0]!.id;
    } else {
      refLookupMulti = refHits.map((h) => ({
        id: h.id,
        public_ref: String(h.public_ref ?? "").trim(),
        event_date: eventDateFromReservationJoin(h.event_days) ?? "",
        team_name: singleTeam(h.teams)?.team_name?.trim() || "—",
      }));
    }
  }

  const { data: dateOptions, error: datesErr } = dateOptsRes;

  const dateRows = (dateOptions ?? []) as { event_date: string }[];
  const dateChoiceSet = new Set(dateRows.map((r) => r.event_date));
  if (isIsoDateOnly(effectiveDate)) {
    dateChoiceSet.add(effectiveDate);
  }
  const dateChoicesSorted = [...dateChoiceSet].sort();

  let day: EventDayHeaderRow | null = null;
  let dayErr = null;

  if (
    byIdRow &&
    isIsoDateOnly(effectiveDate) &&
    byIdRow.event_date === effectiveDate
  ) {
    day = byIdRow;
  } else {
    const res = await supabase
      .from("event_days")
      .select("id, event_date, grade_band, status")
      .eq("event_date", effectiveDate)
      .maybeSingle();
    day = (res.data ?? null) as EventDayHeaderRow | null;
    dayErr = res.error;
  }

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
        public_ref,
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
        if (refSingleReservationId && r.id !== refSingleReservationId) {
          return false;
        }
        if (refSingleReservationId) {
          return true;
        }
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

  const teamDefault = typeof sp.team === "string" ? sp.team : "";
  const emailDefault = typeof sp.email === "string" ? sp.email : "";

  return (
    <div className="min-w-0 space-y-4">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
        予約の確認・変更
      </h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
        <form
          method="get"
          action="/admin/reservations"
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex min-w-0 flex-col gap-0.5 sm:max-w-md">
            <span className="text-xs font-medium text-zinc-600">予約番号</span>
            <input
              name="ref"
              type="search"
              defaultValue={refRaw}
              placeholder="例: A3K9P2"
              className={`${inputClass} w-full max-w-full font-mono sm:w-[min(100%,18rem)]`}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-800 sm:mb-px"
          >
            検索
          </button>
        </form>

        <div className="mt-3 border-t border-zinc-100 pt-3">
          <p className="text-xs font-semibold text-zinc-700">条件で探す</p>
          <form
            method="get"
            action="/admin/reservations"
            className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <label className="block min-w-0 text-xs sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-zinc-600">開催日</span>
              {dateChoicesSorted.length > 0 ? (
                <select
                  name="date"
                  defaultValue={effectiveDate}
                  className={inputClass}
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
                  className={inputClass}
                />
              )}
            </label>
            <label className="block min-w-0 text-xs">
              <span className="font-medium text-zinc-600">チーム名</span>
              <input
                name="team"
                type="search"
                defaultValue={teamDefault}
                placeholder="部分一致"
                className={inputClass}
              />
            </label>
            <label className="block min-w-0 text-xs">
              <span className="font-medium text-zinc-600">メール</span>
              <input
                name="email"
                type="search"
                defaultValue={emailDefault}
                placeholder="部分一致"
                className={inputClass}
              />
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
              <button
                type="submit"
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 sm:min-w-[6.5rem] sm:flex-initial"
              >
                絞り込み
              </button>
              <Link
                href="/admin/reservations"
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 sm:min-w-[6.5rem] sm:flex-initial"
              >
                リセット
              </Link>
            </div>
          </form>
        </div>
      </div>

      {refLookupNotFound ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950 sm:text-sm">
          入力した予約番号に一致する予約がありません。スペースなど入力を確認してください。
        </p>
      ) : null}
      {refLookupMulti.length > 0 ? (
        <div className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 sm:text-sm">
          <p className="font-medium leading-snug text-sky-950">
            予約番号に {refLookupMulti.length}{" "}
            件該当しました。開催日・チームを確認して詳細を開いてください。
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {refLookupMulti.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/admin/reservations/${h.id}`}
                  className="inline-flex flex-wrap items-baseline gap-x-2 font-medium text-sky-900 underline underline-offset-2 hover:text-sky-950"
                >
                  <span className="font-mono text-xs sm:text-sm">
                    {formatReservationPublicRefForDisplay(h.public_ref) ||
                      h.public_ref}
                  </span>
                  <span className="text-xs text-sky-800/90">
                    {h.event_date && isIsoDateOnly(h.event_date)
                      ? formatIsoDateWithWeekdayJa(h.event_date)
                      : "開催日不明"}
                  </span>
                  <span className="text-xs text-sky-900/90">· {h.team_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {refRaw &&
      refSingleReservationId &&
      !refLookupNotFound &&
      refLookupMulti.length === 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950 sm:text-sm">
          該当する予約を表示しました。
        </p>
      ) : null}

      {datesErr ? (
        <p className="text-sm text-red-600">開催日一覧を読み込めませんでした。</p>
      ) : null}
      {dayErr ? (
        <p className="text-sm text-red-600">開催日情報を読み込めませんでした。</p>
      ) : !day ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-xs leading-snug text-zinc-700 sm:text-sm">
          <p>この日付の開催はありません。</p>
          <p className="mt-1">
            「条件で探す」で別の開催日を選ぶか、予約番号で検索してください。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold text-zinc-900 sm:text-base">
                {formatIsoDateWithWeekdayJa(day.event_date)}の予約　{rows.length}
                件
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
                学年：{day.grade_band}　状態：
                {eventDayStatusLabelJa(day.status)}
              </p>
            </div>
            {hubHref ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
                <Link
                  href={hubHref}
                  className="font-semibold text-emerald-800 underline decoration-emerald-600/50 underline-offset-2 hover:text-emerald-950"
                >
                  この日の運営画面へ
                </Link>
                <Link
                  href={preDayHref}
                  className="font-semibold text-sky-800 underline decoration-sky-600/50 underline-offset-2 hover:text-sky-950"
                >
                  試合表を調整
                </Link>
              </div>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-xs leading-snug text-zinc-700 sm:text-sm">
              <p className="font-medium text-zinc-900">
                該当する予約が見つかりませんでした。
              </p>
              <p className="mt-1.5">
                予約番号、チーム名、メールアドレスに間違いがないか確認してください。
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {rows.map((r) => {
                  const t = singleTeam(r.teams);
                  if (!t) return null;
                  return (
                    <article
                      key={r.id}
                      className="rounded-lg border border-zinc-200/90 bg-white p-3 shadow-sm ring-1 ring-zinc-100/80"
                    >
                      <dl className="space-y-2 text-sm text-zinc-800">
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">
                            予約番号
                          </dt>
                          <dd className="mt-0.5 font-mono text-sm font-semibold tracking-wide text-zinc-900">
                            {formatReservationPublicRefForDisplay(r.public_ref) ||
                              "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">
                            チーム・申込者
                          </dt>
                          <dd className="mt-1 space-y-0.5">
                            <p>
                              <span className="text-zinc-500">チーム名：</span>
                              <span className="wrap-break-word font-medium">
                                {t.team_name}
                              </span>
                            </p>
                            <p>
                              <span className="text-zinc-500">申込者：</span>
                              <span className="wrap-break-word">{t.contact_name}</span>
                            </p>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">
                            連絡先
                          </dt>
                          <dd className="mt-0.5 wrap-break-word text-sm">
                            {t.contact_email}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">
                            予約内容
                          </dt>
                          <dd className="mt-1 space-y-0.5">
                            <p>
                              代表学年：
                              {t.representative_grade_year == null
                                ? "—"
                                : `${t.representative_grade_year}年`}
                            </p>
                            <p>人数：{r.participant_count}名</p>
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
                          <dt className="text-xs font-medium text-zinc-500">
                            状態
                          </dt>
                          <dd>
                            <ReservationStatusBadge status={r.status} />
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 border-t border-zinc-100 pt-2">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
                        >
                          詳細を見る
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden min-w-0 max-w-full md:block">
                <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                  <table className="min-w-[44rem] w-full border-collapse text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 sm:text-sm">
                      <tr>
                        <th className="whitespace-nowrap px-2 py-2 sm:px-3">
                          予約番号
                        </th>
                        <th className="min-w-[10rem] px-2 py-2 sm:px-3">
                          チーム・申込者
                        </th>
                        <th className="min-w-[9rem] px-2 py-2 sm:px-3">
                          連絡先
                        </th>
                        <th className="min-w-[9rem] px-2 py-2 sm:px-3">
                          予約内容
                        </th>
                        <th className="whitespace-nowrap px-2 py-2 sm:px-3">
                          状態
                        </th>
                        <th className="sticky right-0 z-10 min-w-[7.5rem] whitespace-nowrap border-l border-zinc-200 bg-zinc-50 px-2 py-2 text-center shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] sm:px-3">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {rows.map((r) => {
                        const t = singleTeam(r.teams);
                        if (!t) return null;
                        return (
                          <tr key={r.id} className="group align-top bg-white">
                            <td className="px-2 py-2 font-mono text-xs tabular-nums sm:px-3 sm:text-sm">
                              {formatReservationPublicRefForDisplay(r.public_ref) ||
                                "—"}
                            </td>
                            <td className="max-w-[14rem] px-2 py-2 sm:px-3">
                              <div className="space-y-1 text-sm leading-snug">
                                <p className="wrap-break-word">
                                  <span className="text-zinc-500">チーム名：</span>
                                  {t.team_name}
                                </p>
                                <p className="wrap-break-word">
                                  <span className="text-zinc-500">申込者：</span>
                                  {t.contact_name}
                                </p>
                              </div>
                            </td>
                            <td className="max-w-[14rem] px-2 py-2 sm:px-3">
                              <p className="wrap-break-word text-sm leading-snug">
                                {t.contact_email}
                              </p>
                            </td>
                            <td className="max-w-[12rem] px-2 py-2 sm:px-3">
                              <div className="space-y-1 text-sm leading-snug text-zinc-800">
                                <p>
                                  代表学年：
                                  {t.representative_grade_year == null
                                    ? "—"
                                    : `${t.representative_grade_year}年`}
                                </p>
                                <p>人数：{r.participant_count}名</p>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                              <ReservationStatusBadge status={r.status} />
                            </td>
                            <td className="sticky right-0 z-1 min-w-[7.5rem] border-l border-zinc-200 bg-white px-2 py-2 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] group-hover:bg-zinc-50/90 sm:px-3">
                              <Link
                                href={`/admin/reservations/${r.id}`}
                                className="inline-flex min-h-9 w-full min-w-[6.5rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
                              >
                                詳細を見る
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
