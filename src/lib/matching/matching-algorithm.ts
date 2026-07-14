import type { FormationMode } from "@/lib/event-days/formation-mode";

export type MatchingAlgorithm = "v2" | "legacy";

/**
 * 編成アルゴリズムの解決。
 * - 環境変数 MATCHING_ALGORITHM=legacy で全体を旧に戻す
 * - 開催日の formation_mode=legacy も旧
 */
export function resolveMatchingAlgorithm(input: {
  formationMode?: string | null;
}): MatchingAlgorithm {
  const env = process.env.MATCHING_ALGORITHM?.trim().toLowerCase();
  if (env === "legacy") return "legacy";

  const mode = (input.formationMode ?? "round_robin").trim() as FormationMode;
  if (mode === "legacy") return "legacy";
  return "v2";
}

export function isTournamentFormationMode(formationMode?: string | null): boolean {
  return (formationMode ?? "").trim() === "tournament";
}
