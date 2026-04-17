"use client";

/** SCR-02: 予約完了。確認コードは sessionStorage。詳細は API で取得して表示。 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LunchOrderSummary } from "../_components/lunch-order-summary";
import { IconCheck, IconClipboard, IconCopy } from "../_components/reserve-icons";
import { ReserveStepper } from "../_components/reserve-stepper";
import { ReserveHeadingWithIcon } from "../_components/ui/reserve-heading-with-icon";
import { formatIsoDateWithWeekdayJa } from "@/lib/dates/format-jp-display";
import { strengthCategoryLabelJa } from "@/lib/reservations/strength-labels";
import type { ReservationLunchLinePublic } from "@/lib/lunch/types";

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
  const [stored, setStored] = useState<Stored | null>(null);
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
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
        setLoadErr(json.error ?? "予約内容の取得に失敗しました");
        return;
      }
      setDetail(json.reservation);
    })();
    return () => {
      cancelled = true;
    };
  }, [stored?.reservationToken]);

  async function copyConfirmationCode() {
    if (!stored) return;
    try {
      await navigator.clipboard.writeText(stored.reservationToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function clearAndGoManage() {
    try {
      sessionStorage.removeItem(SESSION_COMPLETE_KEY);
    } catch {
      /* ignore */
    }
    router.push("/reserve/manage");
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
        <ReserveStepper current={1} />
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconCheck className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />}
          textClassName="text-lg font-bold text-rp-navy sm:text-xl"
        >
          予約完了
        </ReserveHeadingWithIcon>
        <p className="text-sm leading-relaxed text-zinc-600">
          表示できる予約情報がありません。予約直後の画面のみ表示されます。
        </p>
        <Link
          href="/reserve"
          className="inline-flex min-h-11 items-center font-semibold text-rp-brand underline"
        >
          予約トップへ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ReserveStepper current={4} />

      <div className="flex flex-col items-center text-center">
        <ReserveHeadingWithIcon
          as="h1"
          shell="navy"
          icon={<IconCheck className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.25} />}
          className="justify-center"
          textClassName="text-center text-xl font-bold text-rp-navy sm:text-2xl"
        >
          予約が完了しました
        </ReserveHeadingWithIcon>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          ご予約いただき、ありがとうございます。以下の内容で予約を受け付けました。
        </p>
      </div>

      {detail ? (
        <div className="overflow-hidden rounded-2xl border border-rp-mint-2 bg-white shadow-sm">
          <div className="flex items-center justify-center gap-2 bg-rp-navy px-4 py-3 text-center text-sm font-semibold text-white sm:text-base">
            <IconClipboard className="h-5 w-5 shrink-0 opacity-90" />
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
                  開催日の2日前 15:00 締切後、編成結果を登録メールアドレス宛にお送りします（送信時刻は運用により前後します）。
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

      <div className="rounded-2xl border-2 border-rp-brand/40 bg-rp-mint/40 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-rp-brand">
          確認コード
        </p>
        <p className="mt-2 break-all font-mono text-sm font-bold text-zinc-900 sm:text-base">
          {stored.reservationToken}
        </p>
        <button
          type="button"
          onClick={() => void copyConfirmationCode()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white hover:bg-rp-brand-hover sm:w-auto"
        >
          {copied ? (
            "コピーしました"
          ) : (
            <>
              <IconCopy className="h-4 w-4 shrink-0" />
              確認コードをコピー
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <p className="font-medium text-amber-900">ご注意</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>変更・キャンセルには確認コードが必要です。紛失にご注意ください。</li>
          <li>確認メールが届かない場合は、迷惑メールフォルダもご確認ください。</li>
          <li>雨天情報等は前日までの案内を予定しています。</li>
        </ul>
      </div>

      <p className="text-center text-xs text-zinc-500">
        予約 ID（参考）: {stored.reservationId}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={clearAndGoManage}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover sm:max-w-xs"
        >
          <IconClipboard className="h-5 w-5 shrink-0 opacity-95" strokeWidth={1.65} />
          予約内容を確認・キャンセルする
        </button>
        <Link
          href="/reserve"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border-2 border-rp-brand bg-white px-6 text-sm font-semibold text-rp-brand hover:bg-rp-mint/40 sm:max-w-xs"
        >
          開催日一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
