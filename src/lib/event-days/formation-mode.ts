/** 開催日の編成様式（V2） */

export const FORMATION_MODES = ["round_robin", "tournament", "legacy"] as const;

export type FormationMode = (typeof FORMATION_MODES)[number];

export const FORMATION_MODE_OPTIONS: ReadonlyArray<{
  value: FormationMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: "round_robin",
    label: "総当たり（標準）",
    description: "締切後に全チーム総当たりで編成します。",
  },
  {
    value: "tournament",
    label: "トーナメント（準備中）",
    description: "枠テンプレのみ。自動編成は未実装です。",
    disabled: true,
  },
  {
    value: "legacy",
    label: "旧編成（レガシー）",
    description: "変更前の平準化アルゴリズムを使います。",
  },
];

export function isFormationMode(value: string): value is FormationMode {
  return (FORMATION_MODES as readonly string[]).includes(value.trim());
}

export function formationModeLabelJa(mode: string): string {
  const m = mode.trim();
  if (m === "round_robin") return "総当たり";
  if (m === "tournament") return "トーナメント";
  if (m === "legacy") return "旧編成";
  return m || "—";
}
