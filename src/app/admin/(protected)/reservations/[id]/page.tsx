import Link from "next/link";
import { notFound } from "next/navigation";

import { LunchOrderSummary } from "@/app/reserve/_components/lunch-order-summary";

import { ReservationCreatedMailResendClient } from "../reservation-created-mail-resend-client";
import { ReservationDetailEditClient } from "../reservation-detail-edit-client";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import type { ReservationLunchLinePublic } from "@/lib/lunch/types";
import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import { formatAdminIdTail } from "@/lib/admin/operator-display";
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

/** notifications.status（送信処理の記録・表示のみ。到達可否ではない） */
function reservationCreatedMailNotifyStatusJa(s: string): string {
  switch (s) {
    case "pending":
      return "送信待ち";
    case "sent":
      return "送信処理済み";
    case "failed":
      return "送信エラー";
    default:
      return s;
  }
}

const NOTIFY_ERR_SNIP = 200;
function snipNotificationError(msg: string | null): string | null {
  if (!msg?.trim()) return null;
  const t = msg.trim();
  if (t.length <= NOTIFY_ERR_SNIP) return t;
  return `${t.slice(0, NOTIFY_ERR_SNIP - 1)}…`;
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

  const { data: lunchRows } = await supabase
    .from("reservation_lunch_items")
    .select(
      "menu_item_id, item_name_snapshot, unit_price_snapshot_tax_included, quantity, line_total, created_at"
    )
    .eq("reservation_id", row.id)
    .order("created_at", { ascending: true });

  const lunchLines: ReservationLunchLinePublic[] = (lunchRows ?? []).map(
    (r) => {
      const x = r as {
        menu_item_id: string | null;
        item_name_snapshot: string;
        unit_price_snapshot_tax_included: number;
        quantity: number;
        line_total: number;
      };
      return {
        menuItemId: x.menu_item_id,
        itemName: x.item_name_snapshot,
        unitPriceTaxIncluded: Number(x.unit_price_snapshot_tax_included),
        quantity: Number(x.quantity),
        lineTotal: Number(x.line_total),
      };
    }
  );
  const lunchTotal = lunchLines.reduce((s, x) => s + x.lineTotal, 0);

  const { data: createdMailNotifyRows } = await supabase
    .from("notifications")
    .select("id, status, created_at, sent_at, updated_at, error_message")
    .eq("reservation_id", row.id)
    .eq("template_key", "reservation_created")
    .order("created_at", { ascending: false });

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
      const orderNum =
        String(slot.slot_code ?? "").match(/(\d+)\s*$/)?.[1] ?? "";
      morningSlotLabel = `午前${orderNum}（${st}〜${et}）`;
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
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
          照会番号（末尾）:{" "}
          <span className="font-mono text-zinc-700">{formatAdminIdTail(row.id)}</span>
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-800">
        <p>
          枠・試合の変更は{" "}
          <Link href={preDayHref} className="font-medium text-sky-800 underline underline-offset-2">
            編成を調整
          </Link>
          または「対戦表・自動編成」タブの運用へ。
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
            <dd>{eventDayStatusLabelJa(day.status)}</dd>
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

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">昼食（予約したときの内容）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          単価・メニュー名は、予約した時点の税込です。あとから昼食メニューを直しても、この予約に表示されている金額・品名は変わりません。
        </p>
        <div className="mt-3">
          <LunchOrderSummary lines={lunchLines} totalTaxIncluded={lunchTotal} />
        </div>
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

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">
          予約完了メール（送信ログ）
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          送信処理の記録です（受信者への到達を保証するものではありません）。再送のたびに行が増えます（最新が上）。画面の再送クールダウンとは別の情報です。
        </p>
        {(createdMailNotifyRows ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            該当する通知行はまだありません。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
            {(createdMailNotifyRows ?? []).map((raw) => {
              const n = raw as {
                id: string;
                status: string;
                created_at: string;
                sent_at: string | null;
                updated_at: string | null;
                error_message: string | null;
              };
              const err = snipNotificationError(n.error_message);
              return (
                <li key={n.id} className="px-3 py-3 text-sm sm:px-4">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold text-zinc-900">
                      {reservationCreatedMailNotifyStatusJa(n.status)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      登録: {formatDateTimeTokyoWithWeekday(n.created_at)}
                    </span>
                    {n.status === "sent" && n.sent_at ? (
                      <span className="text-xs text-zinc-500">
                        送信完了: {formatDateTimeTokyoWithWeekday(n.sent_at)}
                      </span>
                    ) : null}
                    {n.status === "failed" && n.updated_at ? (
                      <span className="text-xs text-zinc-500">
                        失敗記録: {formatDateTimeTokyoWithWeekday(n.updated_at)}
                      </span>
                    ) : null}
                  </div>
                  {err ? (
                    <p className="mt-2 font-mono text-xs leading-relaxed text-red-800">
                      {err}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReservationCreatedMailResendClient
        key={`${row.id}-${team.contact_email}`}
        reservationId={row.id}
        defaultToEmail={team.contact_email}
        reservationActive={row.status === "active"}
      />
    </div>
  );
}
