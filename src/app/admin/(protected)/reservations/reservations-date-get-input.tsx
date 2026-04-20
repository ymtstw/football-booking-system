"use client";

import { DateInputWithPicker } from "@/components/ui/date-input-with-picker";

/** GET フォーム用（サーバー page から差し込む） */
export function ReservationsDateGetInput({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue: string;
  className: string;
}) {
  return <DateInputWithPicker name={name} type="date" defaultValue={defaultValue} className={className} />;
}
