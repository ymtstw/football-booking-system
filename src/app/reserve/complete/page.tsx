"use client";

/** SCR-02: 予約完了。確認コードは sessionStorage。要約は API で取得。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import {
  formatDateTimeTokyoWithWeekday,
  formatIsoDateWithWeekdayJa,
} from "@/lib/dates/format-jp-display";
import type { ReservationLunchLinePublic } from "@/lib/lunch/types";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";
import { formatReservationConfirmationDisplay } from "@/lib/reservations/confirmation-code";
import { formatReservationPublicRefForDisplay } from "@/lib/reservations/public-ref";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

const SESSION_COMPLETE_KEY = "football_reservation_complete_v1";
const CONTACT_PHONE =
  process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "04-1234-5678";

type Stored = {
  reservationToken: string;
  reservationTokenDisplay?: string;
  publicRef?: string;
  /** 旧セッション互換（参照しない） */
  reservationId?: string;
  eventDate?: string;
};

type ReservationDetail = {
  publicRef?: string;
  status: string;
  participantCount: number;
  lunchItems: ReservationLunchLinePublic[];
  lunchTotalTaxIncluded: number;
  eventDay: {
    eventDate: string;
    gradeBand: string;
    reservationDeadlineAt: string;
  };
  morningSlot: {
    startTime: string;
    endTime: string;
  } | null;
  team: {
    teamName: string;
    strengthCategory: string;
    contactName: string;
    contactEmail: string;
  };
};

/** 完了画面の表示・コピー用（メールと同じくハイフン付き。API から display が無いときは正規形から生成） */
function reservationConfirmationDisplayForComplete(stored: Stored): string {
  const d = stored.reservationTokenDisplay?.trim();
  if (d) return d;
  return formatReservationConfirmationDisplay(stored.reservationToken);
}

function formatHm(t: string): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function gradeBandLabelJa(band: string): string {
  const g = band.trim();
  if (g === "1-2") return "1〜2年生";
  if (g === "3-4") return "3〜4年生";
  if (g === "5-6") return "5〜6年生";
  return g;
}

function SummaryItem({ label, children: value }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-snug text-zinc-900">{value}</div>
    </div>
  );
}

function LunchLinesCompact({ lines }: { lines: ReservationLunchLinePublic[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-zinc-700">昼食の申込はありません。</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-zinc-800">
      {lines.map((line, i) => (
        <li key={`${line.menuItemId ?? "x"}-${line.itemName}-${i}`} className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
          <span className="min-w-0 font-medium text-zinc-900">
            {line.itemName}
            <span className="font-normal text-zinc-600"> ×{line.quantity}</span>
          </span>
          <span className="shrink-0 tabular-nums text-zinc-700">{formatTaxIncludedYen(line.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReserveCompletePage() {
  const router = useRouter();
  const [managePending, startManageTransition] = useTransition();
  const [stored, setStored] = useState<Stored | null>(null);
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /** 直近にコピーした種別（枠内ミニボタン用） */
  const [copiedKind, setCopiedKind] = useState<null | "publicRef" | "confirmation">(null);
  const [copying, setCopying] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_COMPLETE_KEY);
        if (!raw) {
          setStored(null);
          return;
        }
        const parsed = JSON.parse(raw) as Stored;
        if (!parsed.reservationToken) {
          setStored(null);
          return;
        }
        /** 新版は publicRef 必須。旧データは reservationId があれば許容（表示はトークン GET で取得） */
        if (!parsed.publicRef?.trim() && !parsed.reservationId) {
          setStored(null);
          return;
        }
        setStored(parsed);
      } catch {
        setStored(null);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!stored?.reservationToken) return;
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const res = await fetch(
          `/api/reservations/${encodeURIComponent(stored.reservationToken)}`
        );
        const json = (await res.json().catch(() => ({}))) as {
          reservation?: ReservationDetail;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.reservation) {
          setDetail(null);
          setLoadErr(
            reserveFlowApiErrorDisplay(
              res.status,
              typeof json.error === "string" ? json.error : undefined,
              "予約内容の取得に失敗しました"
            )
          );
          return;
        }
        setDetail(json.reservation);
      } catch (e) {
        if (cancelled) return;
        setDetail(null);
        setLoadErr(
          reserveFlowUserVisibleMessage(
            e instanceof Error ? e.message : String(e),
            RESERVE_FLOW_NETWORK_ERROR_JA
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stored?.reservationToken]);

  async function copyReservationSnippet(
    text: string,
    kind: "publicRef" | "confirmation"
  ): Promise<void> {
    if (!text.trim()) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(null), 2000);
    } catch {
      setCopiedKind(null);
    } finally {
      setCopying(false);
    }
  }

  function clearAndGoManage() {
    try {
      sessionStorage.removeItem(SESSION_COMPLETE_KEY);
    } catch {
      /* ignore */
    }
    startManageTransition(() => {
      router.push("/reserve/manage");
    });
  }

  if (!hydrated) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        読み込み中…
      </p>
    );
  }

  if (!stored) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-lg font-bold text-rp-navy sm:text-xl">予約完了</h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          表示できる予約情報がありません。予約直後の画面のみ表示されます。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/reserve/calendar"
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-rp-brand bg-white px-5 text-sm font-semibold text-rp-brand hover:bg-rp-mint/30"
          >
            予約手続き（開催日選択）へ
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-rp-brand px-5 text-sm font-semibold text-white hover:bg-rp-brand-hover"
          >
            イベント案内に戻る
          </Link>
        </div>
      </div>
    );
  }

  const morningSlotLabel =
    detail?.morningSlot != null
      ? `${formatHm(detail.morningSlot.startTime)}〜${formatHm(detail.morningSlot.endTime)}`
      : "—";

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-10 sm:max-w-2xl sm:space-y-7">
      {/* 1. 完了メッセージ */}
      <header className="space-y-2 text-center sm:text-left">
        <h1 className="text-xl font-bold text-rp-navy sm:text-2xl">予約が完了しました</h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          ご予約ありがとうございます。確認メールをお送りしました。
        </p>
      </header>

      {/* 2. 予約の確認に必要な情報 */}
      <section
        className="rounded-2xl border-2 border-rp-brand/50 bg-rp-mint/50 p-4 shadow-sm sm:p-5"
        aria-labelledby="complete-confirmation-heading"
      >
        <h2
          id="complete-confirmation-heading"
          className="text-lg font-extrabold tracking-tight text-rp-navy sm:text-xl"
        >
          予約の確認に必要な情報
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-700 sm:text-sm">
          お問い合わせには予約番号、予約の確認・変更・キャンセルには確認コードを使用します。
        </p>

        <div className="mt-4 space-y-5">
          {stored.publicRef ? (
            <div className="space-y-2">
              <h3 className="text-base font-extrabold tracking-tight text-zinc-900 sm:text-lg">
                予約番号
              </h3>
              <p className="text-xs font-medium text-zinc-600 sm:text-sm">
                予約番号はお問い合わせ用です。
              </p>
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-sm sm:px-3 sm:py-2.5">
                <p className="min-w-0 flex-1 break-all font-mono text-base font-bold tracking-wide text-zinc-900 sm:text-lg">
                  {formatReservationPublicRefForDisplay(stored.publicRef)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void copyReservationSnippet(
                      formatReservationPublicRefForDisplay(stored.publicRef),
                      "publicRef"
                    )
                  }
                  disabled={copying}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-none text-rp-brand underline decoration-rp-brand/40 underline-offset-2 hover:bg-rp-mint/50 disabled:cursor-wait disabled:opacity-50 sm:text-xs"
                >
                  {copiedKind === "publicRef" ? "コピー済" : "コピー"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-base font-extrabold tracking-tight text-rp-navy sm:text-lg">
              確認コード
            </h3>
            <p className="text-xs font-medium text-zinc-600 sm:text-sm">予約確認・変更・キャンセル用</p>
            <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-sm sm:px-3 sm:py-2.5">
              <p className="break-all font-mono text-base font-bold tracking-wide text-zinc-900 sm:text-lg">
                {reservationConfirmationDisplayForComplete(stored)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1 text-xs leading-relaxed text-zinc-600 sm:text-sm">
          <p>確認コードはメールにも記載しています。</p>
          <p>第三者に共有せず、大切に保管してください。</p>
        </div>

        <button
          type="button"
          onClick={() =>
            void copyReservationSnippet(
              reservationConfirmationDisplayForComplete(stored),
              "confirmation"
            )
          }
          disabled={copying}
          aria-busy={copying || undefined}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white hover:bg-rp-brand-hover disabled:cursor-wait disabled:opacity-80"
        >
          {copying ? <InlineSpinner variant="onDark" /> : null}
          {copiedKind === "confirmation" ? "コピーしました" : "確認コードをコピー"}
        </button>
      </section>

      {/* 3. 予約内容（要約カード） */}
      {loadErr ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadErr}</p>
      ) : detail ? (
        <section className="space-y-3" aria-labelledby="complete-summary-heading">
          <h2 id="complete-summary-heading" className="text-base font-bold text-rp-navy">
            予約内容
          </h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <SummaryItem label="利用日">{formatIsoDateWithWeekdayJa(detail.eventDay.eventDate)}</SummaryItem>
            <SummaryItem label="対象学年帯">{gradeBandLabelJa(detail.eventDay.gradeBand)}</SummaryItem>
            <SummaryItem label="午前の希望枠">{morningSlotLabel}</SummaryItem>
            <SummaryItem label="チーム名">{detail.team.teamName}</SummaryItem>
            <div className="sm:col-span-2">
              <SummaryItem label="参加選手数">{detail.participantCount}名</SummaryItem>
            </div>
            <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-sm sm:col-span-2 sm:p-4">
              <p className="text-xs font-medium text-zinc-500">昼食内容</p>
              <div className="mt-2">
                <LunchLinesCompact lines={detail.lunchItems} />
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-100 pt-3">
                <span className="text-sm font-semibold text-zinc-800">昼食合計（税込）</span>
                <span className="text-base font-bold tabular-nums text-rp-brand">
                  {formatTaxIncludedYen(detail.lunchTotalTaxIncluded)}
                </span>
              </div>
            </div>
          </div>

          <details className="group rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 sm:px-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-rp-navy marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1">
                詳細を表示
                <span className="text-xs font-normal text-zinc-500 group-open:hidden">（代表者・メール等）</span>
              </span>
            </summary>
            <dl className="mt-3 space-y-2 border-t border-zinc-200 pt-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500">代表者名</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{detail.team.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">メールアドレス</dt>
                <dd className="mt-0.5 break-all font-medium text-zinc-900">{detail.team.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">チームレベル</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {strengthCategoryLabelJa(detail.team.strengthCategory)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">変更・キャンセル締切</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {formatDateTimeTokyoWithWeekday(detail.eventDay.reservationDeadlineAt)}
                </dd>
              </div>
            </dl>
          </details>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
          <InlineSpinner variant="onLight" />
          予約内容を読み込み中…
        </p>
      )}

      {/* 4. 次にご確認ください */}
      <section
        className="rounded-xl border border-rp-mint-2 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4"
        aria-labelledby="complete-next-heading"
      >
        <h2 id="complete-next-heading" className="text-sm font-bold text-rp-navy sm:text-base">
          予約語のご案内
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-800">
          <li>・確認メールをご確認ください。</li>
          <li>・変更・キャンセルは開催日の2日前15:00まで可能です。</li>
          <li>・当日の詳細は、開催日前にメールでお知らせします。</li>
        </ul>
      </section>

      <section
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 shadow-sm sm:px-5 sm:py-4"
        aria-label="メールが届かない場合のご案内"
      >
        <p>
          メールが届かず、確認コードもお控えでない場合は、再度予約登録を行わず、
          <a
            href={`tel:${CONTACT_PHONE.replace(/-/g, "")}`}
            className="mx-1 font-semibold underline decoration-amber-600/50 underline-offset-2"
          >
            {CONTACT_PHONE}
          </a>
          までお電話ください。
        </p>
      </section>

      {/* 5. アクション（最大2つ） */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={clearAndGoManage}
          disabled={managePending}
          aria-busy={managePending || undefined}
          className="inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover disabled:cursor-wait disabled:opacity-80 sm:max-w-xs"
        >
          {managePending ? <InlineSpinner variant="onDark" /> : null}
          予約を確認・キャンセルする
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 w-full flex-1 items-center justify-center rounded-full border-2 border-rp-brand bg-white px-6 text-sm font-semibold text-rp-brand hover:bg-rp-mint/30 sm:max-w-xs"
        >
          イベント案内に戻る
        </Link>
      </div>
    </div>
  );
}
