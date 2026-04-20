/** Chromium 系: 日付入力のテキスト部クリックでもピッカーを開きやすくする */
export function maybeShowDatePicker(el: HTMLInputElement): void {
  const t = el.type;
  if (t !== "date" && t !== "datetime-local" && t !== "time" && t !== "month" && t !== "week") {
    return;
  }
  const extended = el as HTMLInputElement & { showPicker?: () => void | Promise<void> };
  if (typeof extended.showPicker !== "function") return;
  try {
    const r = extended.showPicker();
    if (r != null && typeof (r as Promise<void>).catch === "function") {
      void (r as Promise<void>).catch(() => {});
    }
  } catch {
    // 非対応環境
  }
}
