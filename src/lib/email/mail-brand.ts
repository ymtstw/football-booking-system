/**
 * メール件名の表記統一（サイトの「小学生サッカー対戦予約」と揃える）。
 * ユーザー向けは同一プレフィックスで受信箱での識別性を上げる。
 */
export const MAIL_SUBJECT_BRAND_USER = "【小学生サッカー対戦予約】";

/** 運営向け：公開サイト「お問い合わせ」フォーム */
export const MAIL_SUBJECT_OPS_INQUIRY = "【お問い合わせ】";

/** 運営向け：合宿・宿泊の相談フォーム */
export const MAIL_SUBJECT_OPS_CAMP = "【合宿相談】";

/** 運営向け：バッチ失敗・送信エラーなど */
export const MAIL_SUBJECT_OPS_SYSTEM = "【小学生サッカー対戦予約・運営】";

/** 本文でのサービス呼称（角括弧なし） */
export const MAIL_BODY_SERVICE_NAME = "小学生サッカー対戦予約";
