"use client";

import type { ComponentProps } from "react";

import { maybeShowDatePicker } from "@/lib/ui/open-date-picker";

type Props = Omit<ComponentProps<"input">, "type"> & {
  type: "date" | "datetime-local" | "time";
};

/** テキスト部クリックでもピッカーを開きやすくする（Chromium の showPicker） */
export function DateInputWithPicker({ onClick, className, type, disabled, ...rest }: Props) {
  return (
    <input
      {...rest}
      type={type}
      disabled={disabled}
      className={[className, disabled ? "cursor-not-allowed" : "cursor-pointer"].filter(Boolean).join(" ")}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled) {
          maybeShowDatePicker(e.currentTarget);
        }
      }}
    />
  );
}
