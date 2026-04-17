/** 昼食代の支払い案内（予約フロー共通） */
export function LunchPaymentNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-amber-950 sm:text-sm ${className}`}>
      <span className="font-semibold text-amber-900">お支払い:</span>{" "}
      昼食代は各チームの代表者が現地でまとめてお支払いください（税込表示のみです）。
    </p>
  );
}
