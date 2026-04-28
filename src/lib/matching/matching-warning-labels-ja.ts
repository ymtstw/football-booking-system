/**
 * 自動編成の `warning_json`（英語コード）を管理画面向けの日本語短文に変換する。
 * DB の保存値は変えず、表示層のみで対応する。
 */

const STATIC_LABELS: Record<string, string> = {
  cross_category_match: "強さ区分が異なるチーム同士の対戦（やむを得ない割当）",
  duplicate_opponent: "同日に既に対戦した相手との再対戦",
  afternoon_second_round_fill: "午後の第2段階で割当（枠埋めのため条件を追加で緩めた可能性）",
  mandatory_morning_slot_fill: "午前枠を埋めるための必須割当（通常より条件を広げた組合せ）",
  repeat_morning_play: "同一チームが午前に複数試合へ出場",
  morning_fallback_fill: "午前枠の空きを埋めるフォールバック割当",
  morning_fallback_relaxed_prefs: "希望枠の順序などの制約を緩めて割当",
  match_count_spread_violation: "1日あたりの試合数のばらつき制約を満たせずに割当",
  referee_unassigned: "審判を割り当てられなかった（候補不足）",
};

/** 1 トークン（warning_json の要素）を日本語に */
export function matchingWarningTokenToJa(code: string): string {
  const c = code.trim();
  if (!c) return c;

  const tier = /^afternoon_pair_pick_tier_([A-D])$/i.exec(c);
  if (tier) {
    const t = tier[1].toUpperCase();
    const byTier: Record<string, string> = {
      A: "同カテゴリ優先で再戦を避けた組合せ",
      B: "条件を少し緩めた午後の組合せ",
      C: "条件をさらに緩めた午後の組合せ",
      D: "枠埋めのため条件を大きく緩めた午後の組合せ（混在・再戦を許容し得る）",
    };
    return `午後の対戦組合せ（${byTier[t] ?? "優先度" + t}）`;
  }

  const stage = /^morning_fallback_stage_(\d+)$/.exec(c);
  if (stage) {
    return `午前枠の補充（段階${stage[1]}・希望に沿わない場合あり）`;
  }

  const fixed = STATIC_LABELS[c];
  if (fixed) return fixed;

  return `編成上の注意（${c}）`;
}

/** `warning_json` 全体を一覧表示用の1文字列に */
export function formatMatchingWarningsForDisplay(w: unknown): string {
  if (w == null) return "—";
  if (!Array.isArray(w)) return "—";
  const arr = w.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (arr.length === 0) return "—";
  return arr.map((x) => matchingWarningTokenToJa(x)).join("、");
}

/** 一覧表の「注意」列用の短文（詳細は formatMatchingWarningsForDisplay を title 等で） */
export function matchingWarningTokenToShortJa(code: string): string {
  const c = code.trim();
  if (!c) return "";

  if (/^afternoon_pair_pick_tier_[A-D]$/i.test(c)) return "条件拡張";
  if (/^morning_fallback_stage_\d+$/.test(c)) return "午前希望外";

  switch (c) {
    case "duplicate_opponent":
      return "同一相手";
    case "mandatory_morning_slot_fill":
      return "午前希望外";
    case "repeat_morning_play":
      return "複数試合";
    case "morning_fallback_fill":
      return "補完";
    case "morning_fallback_relaxed_prefs":
      return "条件拡張";
    case "afternoon_second_round_fill":
      return "条件拡張";
    case "cross_category_match":
      return "条件拡張";
    case "match_count_spread_violation":
      return "条件拡張";
    case "referee_unassigned":
      return "審判なし";
    default:
      return "要確認";
  }
}

/** 注意列：複数トークンは短く畳む */
export function formatMatchingWarningsShortLabel(w: unknown): string {
  if (w == null) return "—";
  if (!Array.isArray(w)) return "—";
  const arr = w.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (arr.length === 0) return "—";
  const shorts = [...new Set(arr.map((x) => matchingWarningTokenToShortJa(x)))];
  if (shorts.length === 1) return shorts[0]!;
  if (shorts.length === 2) return `${shorts[0]}・${shorts[1]}`;
  return `${shorts[0]}・${shorts[1]}ほか`;
}
