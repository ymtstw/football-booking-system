"use client";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  notificationTemplateLabelJa,
  notificationStatusLabelJa,
  summarizeOutboundEmailError,
} from "@/lib/admin/notification-failed-display";
import {
  formatDateTimeTokyo,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { formatSlashDateJa } from "@/lib/dates/tokyo-day-bounds";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const RETRY_COOLDOWN_STORAGE_PREFIX = "fb_admin_notif_retry_cd_v1_";

function retryCooldownStorageKey(notificationId: string) {
  return `${RETRY_COOLDOWN_STORAGE_PREFIX}${notificationId}`;
}

function readRetryCooldownUntil(notificationId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(retryCooldownStorageKey(notificationId));
  if (!raw) return null;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.sessionStorage.removeItem(retryCooldownStorageKey(notificationId));
    return null;
  }
  return until;
}

function writeRetryCooldownUntil(notificationId: string, until: number) {
  window.sessionStorage.setItem(retryCooldownStorageKey(notificationId), String(until));
}

function formatRetryRemainingMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export type HistoryNotificationRow = {
  id: string;
  channel: string;
  status: string;
  template_key: string | null;
  error_message: string | null;
  payload_summary?: unknown;
  created_at: string;
  updated_at?: string | null;
  sent_at?: string | null;
  reservation_id: string | null;
  event_day_id?: string | null;
  eventDate?: string | null;
  gradeBand?: string | null;
  toEmail?: string | null;
  teamName?: string | null;
  contactName?: string | null;
};

type DateBasisMode = "eventDate" | "processedDate";
type FilterStatus = "all" | "sent" | "pending" | "failed";

function isReservationIdOnlyPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  const o = value as Record<string, unknown>;
  return (
    keys.length === 1 &&
    keys[0] === "reservation_id" &&
    typeof o.reservation_id === "string"
  );
}

function outboundPayloadSummaryForStaffDisplay(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "この送信には追加情報があります。詳細が必要な場合は担当へ相談してください。";
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  if (isReservationIdOnlyPayload(value)) {
    return "";
  }
  if (keys.length === 1 && keys[0] === "event_date" && typeof o.event_date === "string") {
    return `開催日 ${o.event_date} に関する送信です。`;
  }
  if (typeof o.event_date === "string" && typeof o.variant === "string") {
    const v = o.variant;
    const kind =
      v === "weather"
        ? "天候・実施区分"
        : v === "operational"
          ? "運営中止"
          : v === "normal"
            ? "通常"
            : "その他";
    return `前日最終メール（${kind}）。開催日 ${o.event_date}。`;
  }
  return "この送信には追加情報があります。詳細が必要な場合は担当へ相談してください。";
}

function trimSummary(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function processedAtIso(n: HistoryNotificationRow): string | null {
  const raw = n.sent_at ?? n.updated_at ?? n.created_at;
  return raw ?? null;
}

function RemarksBlock({ row }: { row: HistoryNotificationRow }) {
  const eventMissing = !row.eventDate?.trim();
  const contactMissing = !(row.toEmail?.trim()) && !(row.teamName?.trim());

  const head: string[] = [];
  if (eventMissing) {
    head.push("対象情報なし（対象開催日を特定できません）。");
  }
  if (contactMissing) {
    head.push("予約情報を確認できません（宛先・チームを表示できません）。");
  }

  if (row.status === "failed") {
    const { summaryJa, rawDetail } = summarizeOutboundEmailError(row.error_message);
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {head.map((t) => (
          <p key={t} className="font-medium text-amber-900">
            {t}
          </p>
        ))}
        <p className="text-red-900">{summaryJa}</p>
        {rawDetail ? (
          <details className="rounded border border-red-200/50 bg-white/90 px-2 py-1 text-[10px] text-zinc-700">
            <summary className="cursor-pointer select-none font-medium text-red-950/90">
              送信サービスからの詳細を開く
            </summary>
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[10px] leading-snug text-zinc-800">
              {rawDetail}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  const summary = outboundPayloadSummaryForStaffDisplay(row.payload_summary);
  if (row.status === "pending") {
    return (
      <div className="space-y-1 text-xs leading-relaxed text-zinc-800">
        {head.map((t) => (
          <p key={t} className="font-medium text-amber-900">
            {t}
          </p>
        ))}
        <p className="text-amber-900/90">
          このシステム上では、まだ「送信が完了した」と記録されていません。
        </p>
        {summary ? <p className="wrap-break-word">{trimSummary(summary, 280)}</p> : null}
      </div>
    );
  }

  const reservationOnly = isReservationIdOnlyPayload(row.payload_summary);
  return (
    <div className="space-y-1 text-xs leading-relaxed text-zinc-800">
      {head.map((t) => (
        <p key={t} className="font-medium text-amber-900">
          {t}
        </p>
      ))}
      {row.status === "sent" && reservationOnly ? (
        <p className="text-zinc-500">（概要なし）</p>
      ) : summary ? (
        <p className="wrap-break-word">{trimSummary(summary, 280)}</p>
      ) : (
        <p className="text-zinc-500">（概要テキストなし）</p>
      )}
    </div>
  );
}

function buildSummarySentence(opts: {
  limit: number;
  dateBasis: DateBasisMode;
  date: string;
  status: FilterStatus;
}): string {
  const lim = opts.limit;
  const slash = opts.date ? formatSlashDateJa(opts.date) : "";

  let subject = "メール履歴";
  if (opts.status === "sent") {
    subject = "送信処理済みのメール";
  } else if (opts.status === "pending") {
    subject = "送信待ちのメール";
  } else if (opts.status === "failed") {
    subject = "送信できなかったメール";
  }

  if (!opts.date) {
    return `最新${lim}件を、送信処理日時の新しい順に表示しています。`;
  }

  if (opts.dateBasis === "eventDate") {
    return `対象開催日が ${slash} の${opts.status === "all" ? "メール履歴" : subject}を、送信処理日時の新しい順に表示しています。`;
  }

  return `送信処理日が ${slash} の${opts.status === "all" ? "メール履歴" : subject}を、送信処理日時の新しい順に表示しています。`;
}

function parseFilterStatus(raw: string | null): FilterStatus {
  if (raw === "sent" || raw === "pending" || raw === "failed" || raw === "all") {
    return raw;
  }
  return "all";
}

function buildFetchParams(sp: URLSearchParams): URLSearchParams {
  const q = new URLSearchParams();

  const legacyFailed =
    !sp.has("dateBasis") && sp.get("status") === "failed";
  const dateBasis: DateBasisMode =
    legacyFailed || sp.get("dateBasis") === "processedDate"
      ? "processedDate"
      : "eventDate";
  if (!legacyFailed && sp.get("dateBasis") === "eventDate") {
    q.set("dateBasis", "eventDate");
  } else {
    q.set("dateBasis", dateBasis);
  }

  const d = sp.get("date")?.trim() ?? "";
  if (d) q.set("date", d);

  let st = parseFilterStatus(sp.get("status"));
  if (legacyFailed) st = "failed";
  q.set("status", st);

  const lim = sp.get("limit") === "50" ? 50 : 20;
  q.set("limit", String(lim));

  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  q.set("offset", String(offset));

  return q;
}

type Props = {
  initialFilterDate?: string | null;
};

export function MailNotificationHistoryClient({ initialFilterDate = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dateBasis, setDateBasis] = useState<DateBasisMode>("eventDate");
  const [filterDate, setFilterDate] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [limit, setLimit] = useState<20 | 50>(20);

  const [rows, setRows] = useState<HistoryNotificationRow[]>([]);
  const [mayHaveMore, setMayHaveMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const normalizedUrlRef = useRef(false);

  /** 旧リンク `?status=failed` と空クエリを運営履歴用に正規化 */
  useEffect(() => {
    if (normalizedUrlRef.current) return;
    const sp = new URLSearchParams(searchParams.toString());

    if (!sp.has("dateBasis") && sp.get("status") === "failed") {
      sp.set("dateBasis", "processedDate");
      sp.set("status", "failed");
      sp.set("limit", sp.get("limit") === "50" ? "50" : "20");
      sp.set("offset", "0");
      sp.delete("eventDayId");
      normalizedUrlRef.current = true;
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      return;
    }

    if (
      !sp.has("dateBasis") ||
      !sp.has("status") ||
      !sp.has("limit") ||
      !sp.has("offset")
    ) {
      if (!sp.has("dateBasis")) sp.set("dateBasis", "eventDate");
      if (!sp.has("status")) sp.set("status", "all");
      if (!sp.has("limit")) sp.set("limit", "20");
      if (!sp.has("offset")) sp.set("offset", "0");
      normalizedUrlRef.current = true;
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  /** URL → フォーム（表示用） */
  useEffect(() => {
    const sp = searchParams;
    const legacyFailed =
      !sp.has("dateBasis") && sp.get("status") === "failed";
    const db: DateBasisMode =
      legacyFailed || sp.get("dateBasis") === "processedDate"
        ? "processedDate"
        : "eventDate";

    const d =
      (initialFilterDate && !(sp.get("date") ?? "").trim()
        ? initialFilterDate
        : sp.get("date")) ?? "";

    setDateBasis(db);
    setFilterDate(d.trim());
    setStatus(parseFilterStatus(sp.get("status")));
    setLimit(sp.get("limit") === "50" ? 50 : 20);
  }, [initialFilterDate, searchParams]);

  const fetchParamsForApi = useMemo(
    () => buildFetchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const summaryText = useMemo(() => {
    const limStr = fetchParamsForApi.get("limit") ?? "20";
    const lim = limStr === "50" ? 50 : 20;
    const db = fetchParamsForApi.get("dateBasis") === "processedDate"
      ? "processedDate"
      : "eventDate";
    const st = parseFilterStatus(fetchParamsForApi.get("status"));
    const date = fetchParamsForApi.get("date")?.trim() ?? "";
    return buildSummarySentence({
      limit: lim,
      dateBasis: db,
      date,
      status: st,
    });
  }, [fetchParamsForApi]);

  const emptyMessage = useMemo(() => {
    const st = parseFilterStatus(fetchParamsForApi.get("status"));
    if (st === "failed") {
      return "送信できなかったメールはありません。";
    }
    return "条件に一致するメール送信履歴はありません。日付や状態を変更して再度確認してください。";
  }, [fetchParamsForApi]);

  /** メイン一覧（同一 query で offset=0 の結果） */
  useEffect(() => {
    const ac = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      const q = buildFetchParams(new URLSearchParams(searchParams.toString()));
      q.set("offset", "0");
      try {
        const res = await fetch(`/api/admin/notifications?${q.toString()}`, {
          credentials: "include",
          signal: ac.signal,
        });
        const json = (await res.json()) as {
          notifications?: HistoryNotificationRow[];
          meta?: { mayHaveMore?: boolean };
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "一覧を取得できませんでした。");
          setRows([]);
          setMayHaveMore(false);
          return;
        }
        setRows(json.notifications ?? []);
        setMayHaveMore(Boolean(json.meta?.mayHaveMore));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("通信エラーが発生しました");
        setRows([]);
        setMayHaveMore(false);
      } finally {
        setLoading(false);
      }
    }
    void run();
    return () => ac.abort();
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    const q = new URLSearchParams();
    q.set("dateBasis", dateBasis);
    if (filterDate.trim()) q.set("date", filterDate.trim());
    q.set("status", status);
    q.set("limit", String(limit));
    q.set("offset", "0");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [dateBasis, filterDate, limit, pathname, router, status]);

  const resetFilters = useCallback(() => {
    setDateBasis("eventDate");
    setFilterDate("");
    setStatus("all");
    setLimit(20);
    const q = new URLSearchParams();
    q.set("dateBasis", "eventDate");
    q.set("status", "all");
    q.set("limit", "20");
    q.set("offset", "0");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [pathname, router]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    const q = buildFetchParams(new URLSearchParams(searchParams.toString()));
    q.set("offset", String(rows.length));
    try {
      const res = await fetch(`/api/admin/notifications?${q.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        notifications?: HistoryNotificationRow[];
        meta?: { mayHaveMore?: boolean };
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "続きを取得できませんでした。");
        return;
      }
      const next = json.notifications ?? [];
      setRows((prev) => [...prev, ...next]);
      setMayHaveMore(Boolean(json.meta?.mayHaveMore));
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoadingMore(false);
    }
  }, [rows.length, searchParams]);

  const retryOne = async (id: string) => {
    setRetryingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/notifications/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok?: boolean; status?: string; error?: string };
      if (!res.ok) {
        setMessage(
          json.error ??
            "再送できませんでした。しばらくしてから試すか、システム担当へ相談してください。"
        );
        return;
      }
      writeRetryCooldownUntil(id, Date.now() + RETRY_COOLDOWN_MS);
      setMessage(
        json.status === "sent"
          ? "再送が完了しました。"
          : json.status === "failed"
            ? "再送は失敗しました。表示されている内容を確認するか、担当へ相談してください。"
            : "送信結果がまだ確定していません。しばらくしてから再度確認してください。"
      );
      const q = buildFetchParams(new URLSearchParams(searchParams.toString()));
      q.set("offset", "0");
      const reload = await fetch(`/api/admin/notifications?${q.toString()}`, {
        credentials: "include",
      });
      const body = (await reload.json()) as {
        notifications?: HistoryNotificationRow[];
        meta?: { mayHaveMore?: boolean };
      };
      if (reload.ok) {
        setRows(body.notifications ?? []);
        setMayHaveMore(Boolean(body.meta?.mayHaveMore));
      }
    } catch {
      setMessage("再送リクエストで通信エラーが発生しました");
    } finally {
      setRetryingId(null);
    }
  };

  const eventDateDisplay = (n: HistoryNotificationRow) => {
    const raw = n.eventDate?.trim();
    if (!raw) return "—";
    return formatIsoDateWithWeekdayJa(raw);
  };

  return (
    <div className="min-w-0 space-y-5">
      <section
        aria-label="絞り込み"
        className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-xs font-semibold text-zinc-700">探し方</legend>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="dateBasis"
                  checked={dateBasis === "eventDate"}
                  onChange={() => setDateBasis("eventDate")}
                  className="h-4 w-4"
                />
                <span>対象開催日で探す</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="dateBasis"
                  checked={dateBasis === "processedDate"}
                  onChange={() => setDateBasis("processedDate")}
                  className="h-4 w-4"
                />
                <span>送信処理日で探す</span>
              </label>
            </div>
          </fieldset>

          <label className="block min-w-0 text-sm">
            <span className="font-medium text-zinc-800">日付（1日・任意）</span>
            <input
              type="date"
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 sm:text-sm"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <span className="mt-1 block text-xs text-zinc-500">
              未指定のときは最新のみ（表示件数の上限まで）
            </span>
          </label>

          <label className="block min-w-0 text-sm">
            <span className="font-medium text-zinc-800">状態</span>
            <select
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as FilterStatus)}
            >
              <option value="all">すべて</option>
              <option value="sent">送信処理済み</option>
              <option value="pending">送信待ち</option>
              <option value="failed">送信できなかった</option>
            </select>
          </label>

          <label className="block min-w-0 text-sm">
            <span className="font-medium text-zinc-800">表示件数</span>
            <select
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(e.target.value === "50" ? 50 : 20)}
            >
              <option value={20}>20件</option>
              <option value={50}>50件</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyFilters()}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            この条件で表示
          </button>
          <button
            type="button"
            onClick={() => resetFilters()}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            初期条件に戻す
          </button>
        </div>
      </section>

      <p className="text-sm leading-relaxed text-zinc-800">
        <span className="font-medium text-zinc-900">{summaryText}</span>
      </p>

      {loading ? (
        <p className="text-sm text-zinc-600">読み込み中…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-700">
          {emptyMessage}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((n) => {
              const processedJa = processedAtIso(n)
                ? formatDateTimeTokyo(processedAtIso(n)!)
                : "—";
              const cooldownUntil = readRetryCooldownUntil(n.id);
              const cooldownRemainingMs =
                cooldownUntil != null ? Math.max(0, cooldownUntil - Date.now()) : 0;
              return (
                <article
                  key={n.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">対象開催日</dt>
                      <dd className="mt-0.5 wrap-break-word text-zinc-900">
                        {eventDateDisplay(n)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">メール種類</dt>
                      <dd className="mt-0.5 wrap-break-word font-medium text-zinc-900">
                        {notificationTemplateLabelJa(n.template_key)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">状態</dt>
                      <dd className="mt-0.5 text-zinc-900">
                        {notificationStatusLabelJa(n.status)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">チーム</dt>
                      <dd className="mt-0.5 wrap-break-word text-zinc-800">
                        {n.teamName?.trim() ? n.teamName : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">宛先</dt>
                      <dd className="mt-0.5 wrap-break-word text-zinc-800">
                        {n.toEmail?.trim() ? n.toEmail : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">送信処理日時</dt>
                      <dd className="mt-0.5 tabular-nums text-zinc-800">{processedJa}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-zinc-500">備考</dt>
                      <dd className="mt-0.5">
                        <RemarksBlock row={n} />
                      </dd>
                    </div>
                  </dl>
                  {n.status === "failed" ? (
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      {n.template_key === "reservation_created" ? (
                        <p className="text-xs text-zinc-600">
                          予約完了メールはこの一覧から再送できません（セキュリティ上の理由）。
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            retryingId !== null ||
                            (cooldownRemainingMs > 0 && retryingId !== n.id)
                          }
                          onClick={() => void retryOne(n.id)}
                          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-indigo-700 px-3 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-45"
                        >
                          {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                          {retryingId === n.id
                            ? "送信中…"
                            : cooldownRemainingMs > 0
                              ? `再送まで ${formatRetryRemainingMs(cooldownRemainingMs)}`
                              : "このメールを再送する"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="hidden min-w-0 md:block md:overflow-x-auto md:rounded-lg md:border md:border-zinc-200 md:bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs text-zinc-800 lg:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium">対象開催日</th>
                  <th className="px-3 py-2 font-medium">送信処理日時</th>
                  <th className="px-3 py-2 font-medium">メール種類</th>
                  <th className="px-3 py-2 font-medium">状態</th>
                  <th className="px-3 py-2 font-medium">宛先</th>
                  <th className="px-3 py-2 font-medium">チーム</th>
                  <th className="min-w-48 px-3 py-2 font-medium">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((n) => {
                  const processedJa = processedAtIso(n)
                    ? formatDateTimeTokyo(processedAtIso(n)!)
                    : "—";
                  const cooldownUntil = readRetryCooldownUntil(n.id);
                  const cooldownRemainingMs =
                    cooldownUntil != null ? Math.max(0, cooldownUntil - Date.now()) : 0;
                  return (
                    <tr key={n.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                        {eventDateDisplay(n)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-700">
                        {processedJa}
                      </td>
                      <td className="max-w-40 px-3 py-2 wrap-break-word">
                        {notificationTemplateLabelJa(n.template_key)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {notificationStatusLabelJa(n.status)}
                      </td>
                      <td className="max-w-48 px-3 py-2 wrap-break-word text-zinc-700">
                        {n.toEmail?.trim() ? n.toEmail : "—"}
                      </td>
                      <td className="max-w-48 px-3 py-2 wrap-break-word text-zinc-700">
                        {n.teamName?.trim() ? n.teamName : "—"}
                      </td>
                      <td className="max-w-md px-3 py-2">
                        <RemarksBlock row={n} />
                        {n.status === "failed" ? (
                          <div className="mt-3 border-t border-zinc-100 pt-2">
                            {n.template_key === "reservation_created" ? (
                              <span className="text-[11px] text-zinc-500">
                                再送不可（予約完了メール）
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  retryingId !== null ||
                                  (cooldownRemainingMs > 0 && retryingId !== n.id)
                                }
                                onClick={() => void retryOne(n.id)}
                                className="inline-flex min-h-9 items-center justify-center rounded-md bg-indigo-700 px-2 text-[11px] font-medium text-white hover:bg-indigo-800 disabled:opacity-45 lg:text-xs"
                              >
                                {retryingId === n.id ? <InlineSpinner variant="onDark" /> : null}
                                {retryingId === n.id
                                  ? "送信中…"
                                  : cooldownRemainingMs > 0
                                    ? `再送まで ${formatRetryRemainingMs(cooldownRemainingMs)}`
                                    : "このメールを再送する"}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {mayHaveMore ? (
            <div className="flex flex-col items-center gap-2 border-t border-zinc-200 pt-4">
              <p className="text-center text-xs text-zinc-600">
                続きの履歴がある可能性があります（同一条件のまま次の{" "}
                {fetchParamsForApi.get("limit") === "50" ? 50 : 20} 件です）。
              </p>
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-800 bg-white px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
              >
                {loadingMore
                  ? "読み込み中…"
                  : `次の${fetchParamsForApi.get("limit") === "50" ? 50 : 20}件を表示`}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
