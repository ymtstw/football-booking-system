import { IconCheck } from "./reserve-icons";

/** 予約手続きフロー用（案内ページとは別。開催日選択が起点） */
export type ReserveFlowStep = 1 | 2 | 3 | 4;

const STEPS: { step: ReserveFlowStep; label: string; shortLabel: string }[] = [
  { step: 1, label: "開催日を選ぶ", shortLabel: "開催日" },
  { step: 2, label: "予約情報の入力", shortLabel: "入力" },
  { step: 3, label: "内容の確認", shortLabel: "確認" },
  { step: 4, label: "完了", shortLabel: "完了" },
];

const STEP_TOTAL = STEPS.length;

/** compact: 確認・完了など後半ステップ向けに縦幅を抑える */
export function ReserveStepper({
  current,
  density = "default",
}: {
  current: ReserveFlowStep;
  density?: "default" | "compact";
}) {
  const currentStep = STEPS.find((s) => s.step === current) ?? STEPS[0];
  const compact = density === "compact";

  return (
    <nav
      aria-label="予約手続きの進行状況"
      className={compact ? "mb-2 sm:mb-3" : "mb-2 sm:mb-4"}
    >
      <div className="sm:hidden">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 leading-snug">
          {STEPS.map(({ step, shortLabel }, i) => {
            const done = step < current;
            const active = step === current;
            const baseLabel = compact
              ? done
                ? "text-[10px] font-medium text-slate-800"
                : "text-[10px] text-slate-600"
              : done
                ? "text-[11px] font-medium text-slate-800"
                : "text-[11px] text-slate-600";
            return (
              <li key={step} className="flex items-center gap-1">
                <span
                  className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-green-600 text-white"
                      : done
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <IconCheck className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : (
                    step
                  )}
                </span>
                <span
                  className={
                    active
                      ? "text-xs font-extrabold tracking-tight text-zinc-950"
                      : baseLabel
                  }
                >
                  {shortLabel}
                </span>
                {i < STEPS.length - 1 ? (
                  <span className="text-[11px] text-slate-400" aria-hidden>
                    ›
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="sr-only">
          ステップ {current}/{STEP_TOTAL}: {currentStep.label}
        </p>
      </div>

      {/* sm 以上: 全体を max-width で抑え、接続線は固定幅（画面幅いっぱいに伸ばさない） */}
      <ol
        className={`mx-auto hidden w-full max-w-4xl flex-row flex-wrap items-center justify-center sm:flex ${
          compact ? "gap-y-1" : "gap-y-1.5"
        }`}
      >
        {STEPS.map(({ step, label }, i) => {
          const done = step < current;
          const active = step === current;
          const isLast = i === STEPS.length - 1;

          const pillPad = compact
            ? done
              ? "gap-0.5 px-1.5 py-px sm:gap-1 sm:px-2 sm:py-0.5"
              : "gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1"
            : done
              ? "gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1"
              : "gap-1.5 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5";

          const circleSize = compact
            ? done
              ? "h-4 w-4 text-[9px] sm:text-[10px]"
              : "h-5 w-5 text-[10px] sm:text-[11px]"
            : done
              ? "h-5 w-5 text-[10px] sm:h-6 sm:w-6 sm:text-xs"
              : "h-6 w-6 text-[11px] sm:h-7 sm:w-7 sm:text-xs";

          const checkIcon = compact
            ? "h-2.5 w-2.5 sm:h-2.5 sm:w-2.5"
            : "h-3 w-3 sm:h-3.5 sm:w-3.5";

          const labelCls = compact
            ? done
              ? "text-[10px] font-semibold sm:text-[11px]"
              : "text-[11px] font-bold sm:text-xs"
            : done
              ? "text-[11px] font-semibold sm:text-xs"
              : "text-xs font-bold sm:text-sm";

          return (
            <li
              key={step}
              className="flex shrink-0 items-center"
            >
              <div
                className={`inline-flex shrink-0 flex-row items-center rounded-full border-2 ${pillPad} ${
                  active
                    ? "border-green-600 bg-green-600 text-white shadow-sm"
                    : done
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${circleSize} ${
                    active
                      ? "bg-white/25 text-white"
                      : done
                        ? "bg-green-600 text-white"
                        : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <IconCheck className={checkIcon} strokeWidth={3} />
                  ) : (
                    step
                  )}
                </span>
                <span className={`leading-tight whitespace-nowrap ${labelCls}`}>{label}</span>
              </div>
              {!isLast ? (
                <span
                  className={`mx-1.5 h-0.5 w-6 shrink-0 sm:mx-2 sm:w-10 ${
                    done ? "bg-green-600" : "bg-slate-400"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
