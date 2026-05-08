"use client";

/**
 * SCR-03: 確認コード入力。照合成功後は /reserve/manage/view へ遷移。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconChevronDown } from "../_components/reserve-icons";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { MANAGE_VIEW_TOKEN_SESSION_KEY } from "@/lib/reserve/manage-view-session";
import {
  normalizeReservationTokenPlain,
  isValidReservationTokenFormat,
} from "@/lib/reservations/token-format";
import {
  reserveFlowApiErrorDisplay,
  reserveFlowUserVisibleMessage,
  RESERVE_FLOW_NETWORK_ERROR_JA,
} from "@/lib/reserve/reserve-flow-user-message";

const CONTACT_PHONE =
  process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "04-1234-5678";

type ReservationJson = {
  reservation?: Record<string, unknown>;
  error?: string;
};

export default function ReserveManagePage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function lookup() {
    setLookupError(null);
    const token = normalizeReservationTokenPlain(tokenInput);
    if (!isValidReservationTokenFormat(token)) {
      setLookupError(
        "確認コードが正しくありません。予約完了メールの内容をご確認ください。"
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${encodeURIComponent(token)}`);
      const json = (await res.json().catch(() => ({}))) as ReservationJson;
      if (!res.ok || !json.reservation) {
        setLookupError(
          reserveFlowApiErrorDisplay(
            res.status,
            typeof json.error === "string" ? json.error : undefined,
            "確認できませんでした"
          )
        );
        return;
      }
      try {
        sessionStorage.setItem(MANAGE_VIEW_TOKEN_SESSION_KEY, token);
      } catch {
        /* ignore */
      }
      router.push("/reserve/manage/view");
    } catch (e) {
      setLookupError(
        reserveFlowUserVisibleMessage(
          e instanceof Error ? e.message : String(e),
          RESERVE_FLOW_NETWORK_ERROR_JA
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,820px)] space-y-6 sm:space-y-7">
      <header className="space-y-2 text-center sm:text-left">
        <h1 className="text-xl font-bold text-rp-navy sm:text-2xl">予約の確認・変更</h1>
        <div className="space-y-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
          <p>予約完了メールに記載された確認コードを入力してください。</p>
          <p>予約内容の確認・変更・キャンセルができます。</p>
        </div>
      </header>

      <section
        className="rounded-2xl border-2 border-rp-brand/35 bg-white p-4 shadow-sm sm:p-6"
        aria-labelledby="manage-code-heading"
      >
        <h2 id="manage-code-heading" className="text-base font-bold text-rp-navy sm:text-lg">
          確認コードを入力してください
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
          <p>予約完了メールの「確認コード」を入力してください。</p>
          <p>ハイフンあり・なし、どちらでも入力できます。</p>
          <p className="text-xs text-zinc-600 sm:text-sm">※予約番号では照会できません。</p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/80">
          <label htmlFor="manage-reservation-token" className="sr-only">
            確認コード（必須）
          </label>
          <input
            id="manage-reservation-token"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="例：K3M9P2QX7VNA8D4H"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="min-h-12 w-full min-w-[min(100%,18rem)] border-0 bg-transparent px-3 py-3 font-mono text-sm text-zinc-900 outline-none ring-0 focus:ring-0 sm:min-h-[3.25rem] sm:px-4 sm:text-base"
          />
        </div>
        <button
          type="button"
          onClick={() => void lookup()}
          disabled={loading}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rp-brand px-6 text-sm font-semibold text-white shadow-md hover:bg-rp-brand-hover disabled:cursor-wait disabled:bg-zinc-400"
        >
          {loading ? <InlineSpinner variant="onDark" /> : null}
          {loading ? "確認中…" : "予約内容を確認する"}
        </button>
        {lookupError ? <p className="mt-3 text-sm text-red-700">{lookupError}</p> : null}
      </section>

      <div className="space-y-2 lg:hidden">
        <details className="group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/70 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:content-none hover:bg-zinc-100/70 sm:px-5 sm:py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-bold text-rp-navy sm:text-base">キャンセルについて</span>
            <IconChevronDown
              className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 sm:h-[1.125rem] sm:w-[1.125rem]"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <div className="space-y-2 border-t border-zinc-200 px-4 pb-3 pt-3 text-sm leading-relaxed text-zinc-800 sm:px-5">
            <p>予約内容の確認後、締切前であればキャンセルできます。</p>
            <p>キャンセル可能期限は、開催日の2日前15:00までです。</p>
          </div>
        </details>
        <details className="group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/70 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:content-none hover:bg-zinc-100/70 sm:px-5 sm:py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-bold text-rp-navy sm:text-base">確認コードで確認できないとき</span>
            <IconChevronDown
              className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 sm:h-[1.125rem] sm:w-[1.125rem]"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <div className="space-y-2 border-t border-zinc-200 px-4 pb-3 pt-3 text-sm leading-relaxed text-zinc-800 sm:px-5">
            <p>入力するのは予約番号ではなく、確認コードです。</p>
            <p>予約完了メールの「確認コード」欄をご確認ください。</p>
            <p className="pt-1">確認できない場合は、前後に空白が入っていないかご確認ください。</p>
            <p>
              それでも確認できない場合は、予約番号を添えて
              <Link href="/reserve/contact" className="font-semibold text-rp-brand underline underline-offset-2">
                お問い合わせ
              </Link>
              ください。
            </p>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
              メールが届かず、確認コードもお控えでない場合は、再度予約登録を行わず、
              <a
                href={`tel:${CONTACT_PHONE.replace(/-/g, "")}`}
                className="mx-1 font-semibold underline decoration-amber-600/50 underline-offset-2"
              >
                {CONTACT_PHONE}
              </a>
              までお電話ください。
            </p>
          </div>
        </details>
      </div>
      <div className="hidden space-y-3 lg:block">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-5 py-4 shadow-sm">
          <h3 className="text-sm font-bold text-rp-navy">キャンセルについて</h3>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-800">
            <p>予約内容の確認後、締切前であればキャンセルできます。</p>
            <p>キャンセル可能期限は、開催日の2日前15:00までです。</p>
          </div>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-5 py-4 shadow-sm">
          <h3 className="text-sm font-bold text-rp-navy">確認コードで確認できないとき</h3>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-800">
            <p>入力するのは予約番号ではなく、確認コードです。</p>
            <p>予約完了メールの「確認コード」欄をご確認ください。</p>
            <p className="pt-1">確認できない場合は、前後に空白が入っていないかご確認ください。</p>
            <p>
              それでも確認できない場合は、予約番号を添えて
              <Link href="/reserve/contact" className="font-semibold text-rp-brand underline underline-offset-2">
                お問い合わせ
              </Link>
              ください。
            </p>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
              メールが届かず、確認コードもお控えでない場合は、再度予約登録を行わず、
              <a
                href={`tel:${CONTACT_PHONE.replace(/-/g, "")}`}
                className="mx-1 font-semibold underline decoration-amber-600/50 underline-offset-2"
              >
                {CONTACT_PHONE}
              </a>
              までお電話ください。
            </p>
          </div>
        </section>
      </div>

      <p className="text-center">
        <Link
          href="/reserve/schedule"
          className="text-sm font-semibold text-rp-brand underline underline-offset-2 hover:text-rp-navy"
        >
          開催確認・試合予定を見る
        </Link>
      </p>
    </div>
  );
}
