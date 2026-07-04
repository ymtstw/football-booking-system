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
 * - PC / 判定前: 非リンクのテキスト（クリックしても何も起きない。手動で選択・コピーは可能）
 */
export function PhoneNumber({ phone, className }: PhoneNumberProps) {
  // 既定 false でSSRと初回描画を揃える（ハイドレーション不一致を回避）
  const [isMobile, setIsMobile] = useState(false);

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

  // PC / 判定前: 発信リンクにしない（クリックで無関係なアプリを起動させない）
  return <span className={className}>{phone}</span>;
}
