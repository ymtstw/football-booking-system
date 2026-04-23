"use client";

/** SCR-02: 予約完了。確認コードは sessionStorage。詳細は API で取得して表示。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LunchOrderSummary } from "../_components/lunch-order-summary";
import { ReserveStepper } from "../_components/reserve-stepper";
import {
  RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA,
  RESERVATION_CHANGE_CANCEL_DEADLINE_SENTENCE_JA,
  RESERVE_MAIL_PUBLIC_JA,
  RESERVE_MAIL_TIMING_NOTE_JA,
} from "@/lib/copy/reserve-public-mail-schedule";
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
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";

const SESSION_COMPLETE_KEY = "football_reservation_complete_v1";

type Stored = {
  reservationToken: string;
  reservationId: string;
  eventDate?: string;
};

type ReservationDetail = {
  id: string;
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

export default function ReserveCompletePage() {
  const router = useRouter();
  const [managePending, startManageTransition] = useTransition();
  const [stored, setStored] = useState<Stored | null>(null);
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
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
        if (!parsed.reservationToken || !parsed.reservationId) {
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

  async function copyConfirmationCode() {
    if (!stored) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(stored.reservationToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-rp-navy sm:text-xl">予約完了</h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          表示できる予約情報がありません。予約直後の画面のみ表示されます。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/reserve/calendar"
            className="inline-flex min-h-11 items-center font-semibold text-rp-brand underline"
          >
            予約手続き（開催日選択）へ
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-zinc-600 underline decoration-zinc-400"
          >
            イベント案内へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ReserveStepper current={4} />

      <div className="flex flex-col items-center text-center">
        <h1 className="text-center text-xl font-bold text-rp-navy sm:text-2xl">
          予約が完了しました
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          ご予約いただき、ありがとうございます。以下の内容で予約を受け付けました。
        </p>
      </div>

      <div className="mx-auto w-full max-w-lg rounded-2xl border-2 border-rp-brand/40 bg-rp-mint/40 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-rp-brand">
          確認コード
        </p>
        <p className="mt-2 break-all font-mono text-sm font-bold text-zinc-900 sm:text-base">
          {stored.reservationToken}
        </p>
        <button
          type="button"
          onClick={() => void copyConfirmationCode()}
          disabled={copying}
          aria-busy={copying || undefined}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white hover:bg-rp-brand-hover disabled:cursor-wait disabled:opacity-80 sm:w-auto"
        >
          {copying ? <InlineSpinner variant="onDark" /> : null}
          {copied ? "コピーしました" : "確認コードをコピー"}
        </button>
      </div>

      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm leading-relaxed text-zinc-800">
        <p>予約完了メールを送信しました。届いているか、受信トレイをご確認ください。</p>
        <p className="mt-2">
          数分経っても届かない場合は迷惑メールフォルダもご確認のうえ、それでも見当たらないときは
          <Link
            href="/reserve/contact"
            className="font-semibold text-sky-800 underline underline-offset-2"
          >
            お問い合わせ
          </Link>
          ください。
        </p>
      </div>

      {detail ? (
        <div className="overflow-hidden rounded-2xl border border-rp-mint-2 bg-white shadow-sm">
          <div className="flex items-center justify-center bg-rp-navy px-4 py-3 text-center text-sm font-semibold text-white sm:text-base">
            ご予約内容
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            <dl className="divide-y divide-zinc-100 sm:border-r sm:border-zinc-100">
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">ご利用日</dt>
                <dd className="text-base font-bold text-rp-brand">
                  {formatIsoDateWithWeekdayJa(detail.eventDay.eventDate)}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">対象学年帯</dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {gradeBandLabelJa(detail.eventDay.gradeBand)}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">代表者名</dt>
                <dd className="text-sm text-zinc-900">{detail.team.contactName}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">所属チーム名</dt>
                <dd className="text-sm text-zinc-900">{detail.team.teamName}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">参加予定人数</dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {detail.participantCount}名
                </dd>
              </div>
            </dl>
            <dl className="divide-y divide-zinc-100">
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">チームレベル</dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {strengthCategoryLabelJa(detail.team.strengthCategory)}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">午前対戦枠</dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {detail.morningSlot
                    ? `${formatHm(detail.morningSlot.startTime)}–${formatHm(detail.morningSlot.endTime)}`
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">午後対戦枠</dt>
                <dd className="text-xs leading-relaxed text-zinc-700">
                  開催日の2日前15:00締切後、対戦・枠の案内メールは締切日の{RESERVE_MAIL_PUBLIC_JA.matchingBy}（日本時間）までにお届けする予定です。送信処理は
                  {RESERVE_MAIL_PUBLIC_JA.matchingCronHint}を目安に開始します。{RESERVE_MAIL_TIMING_NOTE_JA}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:px-5">
                <dt className="text-xs font-medium text-zinc-500">ご利用内容</dt>
                <dd className="text-sm text-zinc-800">
                  人工芝グラウンド（無料貸出・イベント枠）
                </dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-zinc-100 px-4 py-4 sm:px-6">
            <p className="text-xs font-medium text-zinc-500">昼食</p>
            <div className="mt-2">
              <LunchOrderSummary
                lines={detail.lunchItems}
                totalTaxIncluded={detail.lunchTotalTaxIncluded}
              />
            </div>
          </div>
        </div>
      ) : loadErr ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadErr}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">予約内容を読み込み中…</p>
      )}

      <div className="rounded-xl border border-rp-mint-2 bg-rp-mint/50 px-4 py-3 text-sm text-zinc-800">
        <ul className="list-disc space-y-1 pl-5">
          <li>イベントは終日の参加を前提としています。</li>
          <li>昼食・お支払い・会場ルールは開催案内に従ってください。</li>
        </ul>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <p className="font-medium text-amber-900">ご注意</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{RESERVATION_CHANGE_CANCEL_DEADLINE_SENTENCE_JA}</li>
          <li>変更・キャンセルには確認コードが必要です。紛失にご注意ください。</li>
          <li>確認メールが届かない場合は、迷惑メールフォルダもご確認ください。</li>
          <li>雨天情報等は開催前日までにご案内する予定です（到着時刻は前後する場合があります）。</li>
        </ul>
      </div>

      {detail ? (
        <div className="rounded-xl border border-rp-mint-2 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-800 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">この予約の変更・キャンセル締切日時</p>
          <p className="mt-1 font-semibold text-rp-navy">
            {formatDateTimeTokyoWithWeekday(detail.eventDay.reservationDeadlineAt)}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            計算の基準は {RESERVATION_CHANGE_CANCEL_DEADLINE_RULE_JA} です（運営設定と一致します）。
          </p>
        </div>
      ) : null}

      <p className="text-center text-xs text-zinc-500">
        予約 ID（参考）: {stored.reservationId}
      </p>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={clearAndGoManage}
          disabled={managePending}
          aria-busy={managePending || undefined}
          className="inline-flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover disabled:cursor-wait disabled:opacity-80"
        >
          {managePending ? <InlineSpinner variant="onDark" /> : null}
          予約内容を確認・キャンセルする
        </button>
      </div>
      <p className="text-center">
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-600 underline decoration-zinc-400 hover:text-rp-navy"
        >
          イベント案内を読む
        </Link>
      </p>
    </div>
  );
}
