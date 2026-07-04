"use client";

import { useEffect, useState } from "react";

type PhoneNumberProps = {
  /** 表示用の電話番号（例: "090-2901-0015"） */
  phone: string;
  /** 表示要素に付与するクラス（既存の見た目を踏襲） */
  className?: string;
};

/**
 * モバイル端末かどうかを判定。
 * PC で tel: リンクが無関係なアプリ（電話リンク/Skype/ストア等）を起動するのを防ぐために使う。
 */
function detectMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const phoneOrTablet = /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
  // iPadOS はデスクトップ UA を返すため、タッチ数で補完
  const ipadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return phoneOrTablet || ipadOs;
}

/**
 * 電話番号の表示。
 * - モバイル: tel: リンク（タップで発信）
 * - PC: リンクにせず、クリックでクリップボードにコピー（発信アプリを起動しない）
 */
export function PhoneNumber({ phone, className }: PhoneNumberProps) {
  // 判定前（SSR・初回描画）は null。ハイドレーション不一致を避けるため双方で同じ描画にする
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobile());
  }, []);

  // モバイル: 発信リンク
  if (isMobile) {
    return (
      <a href={`tel:${phone.replace(/-/g, "")}`} className={className}>
        {phone}
      </a>
    );
  }

  // 判定前: 非リンクのテキスト（PC で無関係なアプリを起動させない）
  if (isMobile === null) {
    return <span className={className}>{phone}</span>;
  }

  // PC: クリック / Enter・Space でクリップボードにコピー
  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // コピー不可の環境では何もしない（テキストは選択可能）
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void copy();
        }
      }}
      title="クリックで電話番号をコピー"
      aria-label={`電話番号 ${phone}、クリックでコピー`}
      className={`relative cursor-pointer ${className ?? ""}`}
    >
      {phone}
      {copied ? (
        <span
          role="status"
          className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow"
        >
          コピーしました
        </span>
      ) : null}
    </span>
  );
}
