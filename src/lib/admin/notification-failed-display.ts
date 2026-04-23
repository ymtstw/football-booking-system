/**
 * 送信失敗一覧の表示用（管理者向けに平易化し、原文は折りたたみで保持）
 */

/** DB の template_key を管理画面用の短い日本語に */
export function notificationTemplateLabelJa(templateKey: string | null): string {
  const k = (templateKey ?? "").trim();
  switch (k) {
    case "reservation_created":
      return "予約直後の確認メール";
    case "day_before_final":
      return "前日の最終メール";
    case "matching_proposal":
      return "マッチング案内";
    case "minimum_cancel_notice":
      return "最少催行中止のお知らせ";
    case "weather_cancel_immediate":
      return "雨天中止（即時）";
    case "operational_cancel_immediate":
      return "運営中止（即時）";
    case "morning_slot_force_changed":
      return "朝枠・時刻の変更案内";
    default:
      return k ? k : "（種別なし）";
  }
}

export type OutboundEmailErrorDisplay = {
  /** 管理者向けの短い説明 */
  summaryJa: string;
  /** 折りたたみ用の原文（送信サービスからのメッセージ） */
  rawDetail: string | null;
};

/**
 * 送信サービス由来の英語エラーを、管理者が次に取るべき行動が分かる程度に要約する。
 * 原文は rawDetail に残し、サポート依頼用に開示する。
 */
export function summarizeOutboundEmailError(raw: string | null): OutboundEmailErrorDisplay {
  const t = (raw ?? "").trim();
  if (!t) {
    return { summaryJa: "理由は記録されていません。", rawDetail: null };
  }
  const lower = t.toLowerCase();

  if (
    lower.includes("only send testing emails") ||
    (lower.includes("testing emails") && lower.includes("your own email"))
  ) {
    return {
      summaryJa:
        "いまの環境は「テスト送信」モードのため、登録メール以外の宛先には送れません。本番公開では送信元ドメインの認証が必要です。開発・運用担当に確認してください。",
      rawDetail: t,
    };
  }

  if (lower.includes("verify a domain") && lower.includes("resend")) {
    return {
      summaryJa:
        "送信元メールのドメインが未認証か、送信元アドレスの指定が正しくない可能性があります。送信サービス側のドメイン設定は開発・運用担当の作業です。",
      rawDetail: t,
    };
  }

  if (lower.includes("too many requests") || /\b429\b/.test(t)) {
    return {
      summaryJa:
        "短時間の送信が多すぎるなどで一時的に拒否されました。時間をおいて再送するか、担当へ相談してください。",
      rawDetail: t,
    };
  }

  // 既に日本語主体で短い場合はそのまま（原文不要）
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(t) && t.length <= 160) {
    return { summaryJa: t, rawDetail: null };
  }

  return {
    summaryJa:
      "メール送信サービスからエラーが返りました。下の「技術メッセージ」をコピーして開発・運用担当へ共有してください。",
    rawDetail: t,
  };
}
