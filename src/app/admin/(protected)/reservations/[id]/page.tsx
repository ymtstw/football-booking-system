import Link from "next/link";
import { notFound } from "next/navigation";

import { LunchOrderSummary } from "@/app/reserve/_components/lunch-order-summary";
import { ReservationAdminCancelClient } from "../reservation-admin-cancel-client";
import { ReservationCreatedMailResendClient } from "../reservation-created-mail-resend-client";
import { ReservationDetailCollapsibleMobile } from "../reservation-detail-collapsible-mobile";
import { ReservationDetailEditClient } from "../reservation-detail-edit-client";
import { ReservationStatusBadge } from "@/components/admin/reservation-status-badge";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import { fetchEffectiveLunchMenuItemsForEventDay } from "@/lib/lunch/effective-lunch-menu-for-event-day";
import type { ReservationLunchLinePublic } from "@/lib/lunch/types";
import { summarizeOutboundEmailError } from "@/lib/admin/notification-failed-display";
import { formatReservationPublicRefForDisplay } from "@/lib/reservations/public-ref";
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
  public_ref: string | null;
  created_at: string;
  updated_at: string;
  selected_morning_slot_id: string | null;
  teams: TeamRow | TeamRow[] | null;
};

function single<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

/** アコーディオン用に短い日時（例: 2026/4/27 18:50） */
function formatShortDateTimeJa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** notifications.status（送信処理の記録・表示のみ） */
function reservationCreatedMailNotifyStatusJa(s: string): string {
  switch (s) {
    case "pending":
      return "送信待ち";
    case "sent":
      return "送信済み";
    case "failed":
      return "失敗";
    default:
      return "要確認";
  }
}

/** 管理: 予約詳細（読み取り＋チーム・予約情報の編集） */
export default async function AdminReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const initialEditOpen =
    typeof sp.edit === "string" && sp.edit.trim() === "1";

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
      public_ref,
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

  const { items: lunchMenuForEdit } =
    await fetchEffectiveLunchMenuItemsForEventDay(supabase, row.event_day_id);

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
  const hubHref = `/admin/event-days/${row.event_day_id}`;
  const listHref = `/admin/reservations?date=${encodeURIComponent(day.event_date)}`;

  const refDisplay =
    formatReservationPublicRefForDisplay(row.public_ref) || "—";

  const lunchQtyTotal = lunchLines.reduce((s, x) => s + x.quantity, 0);
  const lunchSectionPreview =
    lunchLines.length === 0
      ? "なし"
      : `${lunchQtyTotal}食 / 合計 ${Math.round(lunchTotal).toLocaleString("ja-JP")}円`;

  const teamContactPreview = `${team.team_name} / ${team.contact_email}`;

  const firstNotify = (createdMailNotifyRows ?? [])[0] as
    | {
        status: string;
        created_at: string;
      }
    | undefined;
  const mailHistoryPreview = firstNotify
    ? `${reservationCreatedMailNotifyStatusJa(firstNotify.status)} ${formatShortDateTimeJa(firstNotify.created_at)}`
    : "記録なし";

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <Link
          href={listHref}
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          ← この開催日の一覧へ
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
          予約詳細
        </h1>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-700 sm:text-sm">
          予約内容の確認・変更を行います。
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-700 sm:text-sm">
          試合時間や対戦相手を変更する場合は、「
          <Link
            href={preDayHref}
            className="font-semibold text-sky-800 underline decoration-sky-600/40 underline-offset-2 hover:text-sky-950"
          >
            試合表を調整
          </Link>
          」から行ってください。
        </p>
      </div>

      <div className="space-y-3 md:space-y-5">
        <section className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            予約の基本情報
          </h2>
          <div className="mt-4 min-w-0 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">予約状態</p>
                <div className="mt-1.5">
                  <ReservationStatusBadge status={row.status} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-500">予約番号</p>
                <p className="mt-1 font-mono text-base font-semibold tracking-wide text-zinc-900">
                  {refDisplay}
                </p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">開催日</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {formatIsoDateWithWeekdayJa(day.event_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">時間帯</dt>
                <dd className="mt-0.5 text-zinc-900">{morningSlotLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-zinc-500">申込日時</dt>
                <dd className="mt-0.5 wrap-break-word text-zinc-900">
                  {formatDateTimeTokyoWithWeekday(row.created_at)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-zinc-500">最終更新</dt>
                <dd className="mt-0.5 wrap-break-word text-zinc-900">
                  {formatDateTimeTokyoWithWeekday(row.updated_at)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap">
              <Link
                href={hubHref}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                この日の運営画面へ
              </Link>
              <Link
                href={preDayHref}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                試合表を調整
              </Link>
            </div>
          </div>
        </section>

        <ReservationDetailCollapsibleMobile
          title="予約チーム情報"
          sectionPreview={teamContactPreview}
          defaultOpen={initialEditOpen}
          anchorId="team-contact"
        >
          <ReservationDetailEditClient
            key={row.updated_at}
            reservationId={row.id}
            initialEditOpen={initialEditOpen}
            chrome="nested"
            lunchMenuItems={lunchMenuForEdit}
            initialLunchLines={lunchLines}
            initial={{
              participant_count: row.participant_count,
              remarks: row.remarks ?? "",
              team_name: team.team_name,
              contact_name: team.contact_name,
              contact_email: team.contact_email,
              contact_phone: team.contact_phone,
              strength_category: team.strength_category,
              representative_grade_year: team.representative_grade_year,
            }}
          />
        </ReservationDetailCollapsibleMobile>

        <ReservationDetailCollapsibleMobile
          title="昼食・お弁当"
          sectionPreview={lunchSectionPreview}
          defaultOpen={false}
        >
          <div className="min-w-0">
            <div className="mt-0 space-y-1 text-xs leading-relaxed text-zinc-600 sm:text-sm">
              <p>当日用意する昼食の内容です。</p>
              <p>数量と合計金額を確認してください。</p>
            </div>
            <div className="mt-4">
              <LunchOrderSummary
                lines={lunchLines}
                totalTaxIncluded={lunchTotal}
              />
            </div>
            {lunchLines.length > 0 ? (
              <p className="mt-4 border-t border-zinc-100 pt-4 text-center text-lg font-bold tabular-nums text-zinc-900 sm:text-left">
                合計：
                {Math.round(lunchTotal).toLocaleString("ja-JP")}
                円（税込）
              </p>
            ) : null}
          </div>
        </ReservationDetailCollapsibleMobile>

        <ReservationDetailCollapsibleMobile
          title="送信履歴"
          sectionPreview={mailHistoryPreview}
          defaultOpen={false}
        >
          <div className="min-w-0">
            <p className="mt-0 text-xs text-zinc-500">
              予約完了メールの送信履歴です。
            </p>
            {(createdMailNotifyRows ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">
                記録はまだありません。
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
                  const errDisp = summarizeOutboundEmailError(n.error_message);
                  return (
                    <li key={n.id} className="px-3 py-3 text-sm sm:px-4">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-semibold text-zinc-900">
                          {reservationCreatedMailNotifyStatusJa(n.status)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatDateTimeTokyoWithWeekday(n.created_at)}
                        </span>
                      </div>
                      {n.status === "failed" ? (
                        <div className="mt-2 text-xs leading-relaxed text-red-800">
                          <p>{errDisp.summaryJa}</p>
                          {errDisp.rawDetail ? (
                            <details className="mt-1 rounded border border-red-100 bg-red-50/50 px-2 py-1">
                              <summary className="cursor-pointer font-medium text-red-950">
                                詳細を開く
                              </summary>
                              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[10px] text-zinc-800">
                                {errDisp.rawDetail}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ReservationDetailCollapsibleMobile>

        <ReservationDetailCollapsibleMobile
          title="予約完了メール再送"
          sectionPreview={team.contact_email.trim() || "送信先メールアドレス"}
          defaultOpen={false}
        >
          <ReservationCreatedMailResendClient
            key={`${row.id}-${team.contact_email}`}
            reservationId={row.id}
            defaultToEmail={team.contact_email}
            reservationActive={row.status === "active"}
            embedded
          />
        </ReservationDetailCollapsibleMobile>

        <ReservationDetailCollapsibleMobile
          title="予約のキャンセル"
          sectionPreview="危険操作"
          defaultOpen={false}
        >
          <ReservationAdminCancelClient
            reservationId={row.id}
            reservationActive={row.status === "active"}
            embedded
          />
        </ReservationDetailCollapsibleMobile>
      </div>
    </div>
  );
}
