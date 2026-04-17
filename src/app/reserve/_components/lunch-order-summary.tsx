import { formatTaxIncludedYen } from "@/lib/money/format-tax-included-jpy";
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

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[280px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
              <th className="px-3 py-2">メニュー</th>
              <th className="px-3 py-2 whitespace-nowrap">税込単価</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">数量</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">小計</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.menuItemId ?? "x"}-${line.itemName}-${i}`} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2 font-medium text-zinc-900">{line.itemName}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-800">
                  {formatTaxIncludedYen(line.unitPriceTaxIncluded)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                  {line.quantity}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-900">
                  {formatTaxIncludedYen(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
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
        </table>
      </div>
      <LunchPaymentNote />
    </div>
  );
}
