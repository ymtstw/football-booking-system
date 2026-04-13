/** ボタン内など用の小さなスピナー */

type InlineSpinnerProps = {
  className?: string;
  size?: "sm" | "md";
  /**
   * onDark: 濃色ボタン（zinc-900 / emerald / red / amber 等）
   * onLight: 白・薄灰背景・枠付きボタン上
   */
  variant?: "onDark" | "onLight";
};

export function InlineSpinner({
  className = "",
  size = "sm",
  variant = "onDark",
}: InlineSpinnerProps) {
  const dim = size === "md" ? "h-5 w-5 border-2" : "h-4 w-4 border-2";
  const ring =
    variant === "onLight"
      ? "border-zinc-300 border-t-zinc-700"
      : "border-white/35 border-t-white";
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="処理中"
      className={`inline-block shrink-0 animate-spin rounded-full ${dim} ${ring} ${className}`}
    />
  );
}
