import { formatJpyInteger, formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
import type { ReservationLunchLinePublic } from "@/lib/lunch/types";

import { LunchPaymentNote } from "./lunch-payment-note";

type Props = {
  lines: ReservationLunchLinePublic[];
  totalTaxIncluded: number;
  /** 明細が空のときの文言 */
  emptyLabel?: string;
  className?: string;
};

export function LunchOrderSummary({
  lines,
  totalTaxIncluded,
  emptyLabel = "昼食の申込はありません。",
  className = "",
}: Props) {
  if (lines.length === 0) {
    return (
      <div className={`space-y-2 text-sm text-zinc-700 ${className}`}>
        <p>{emptyLabel}</p>
        <LunchPaymentNote />
      </div>
    );
  }

  const showLunchGrandTotal = lines.length > 1;

  return (
    <div className={`min-w-0 space-y-3 ${className}`}>
      {/* スマホ: 1行1カード（横スクロールなし） */}
      <div className="space-y-3 sm:hidden">
        {lines.map((line, i) => (
          <div
            key={`${line.menuItemId ?? "x"}-${line.itemName}-${i}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold leading-snug text-zinc-900 break-words">{line.itemName}</p>
            <div className="mt-3 space-y-3 text-sm">
              <p className="min-w-0 leading-relaxed">
                <span className="text-zinc-500">税込単価：</span>
                <span className="font-medium tabular-nums text-zinc-900">
                  {formatJpyInteger(line.unitPriceTaxIncluded)}
                </span>
              </p>
              <p className="min-w-0 leading-relaxed">
                <span className="text-zinc-500">昼食数：</span>
                <span className="font-medium tabular-nums text-zinc-900">{line.quantity}食</span>
              </p>
              <p className="min-w-0 border-t border-zinc-100 pt-3 text-base font-semibold leading-relaxed">
                <span className="text-sm font-normal text-zinc-500">小計：</span>
                <span className="tabular-nums text-zinc-900">{formatTaxIncludedYen(line.lineTotal)}</span>
              </p>
            </div>
          </div>
        ))}
        {showLunchGrandTotal ? (
          <div className="border-t border-zinc-200 pt-3">
            <p className="text-xs text-zinc-600">昼食合計（税込）</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
              {formatJpyInteger(totalTaxIncluded)}
            </p>
          </div>
        ) : null}
      </div>

      {/* PC: 表形式 */}
      <div className="hidden min-w-0 sm:block">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[280px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                <th className="px-3 py-2">メニュー</th>
                <th className="px-3 py-2 whitespace-nowrap">税込単価</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">昼食数</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">小計</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={`${line.menuItemId ?? "x"}-${line.itemName}-${i}`}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-2 font-medium text-zinc-900">{line.itemName}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-800">
                    {formatJpyInteger(line.unitPriceTaxIncluded)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-800">{line.quantity}食</td>
                  <td className="px-3 py-2 text-right text-base font-semibold tabular-nums text-zinc-900">
                    {formatTaxIncludedYen(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            {showLunchGrandTotal ? (
              <tfoot>
                <tr className="bg-rp-mint/40">
                  <td colSpan={3} className="px-3 py-2 text-right text-sm font-bold text-rp-navy">
                    昼食合計（税込）
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-rp-brand">
                    {formatTaxIncludedYen(totalTaxIncluded)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <LunchPaymentNote />
    </div>
  );
}
