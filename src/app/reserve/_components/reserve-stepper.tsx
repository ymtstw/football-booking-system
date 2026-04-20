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

export function ReserveStepper({ current }: { current: ReserveFlowStep }) {
  const currentStep = STEPS.find((s) => s.step === current) ?? STEPS[0];

  return (
    <nav aria-label="予約手続きの進行状況" className="mb-4 sm:mb-8">
      <div className="sm:hidden">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] leading-tight">
          {STEPS.map(({ step, shortLabel }, i) => {
            const done = step < current;
            const active = step === current;
            return (
              <li key={step} className="flex items-center gap-1">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-green-600 text-white"
                      : done
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-400"
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
                  className={`${
                    active
                      ? "font-bold text-slate-900"
                      : done
                        ? "text-slate-600"
                        : "text-slate-400"
                  }`}
                >
                  {shortLabel}
                </span>
                {i < STEPS.length - 1 ? (
                  <span className="text-slate-300" aria-hidden>
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

      {/* sm 以上: ピルは内容幅で全文表示。区切り線のみ flex で伸縮（均等 flex-1 ピルによる省略を防ぐ） */}
      <ol className="mx-auto hidden w-full max-w-6xl flex-wrap items-center justify-center gap-y-3 sm:flex">
        {STEPS.map(({ step, label }, i) => {
          const done = step < current;
          const active = step === current;
          const isLast = i === STEPS.length - 1;

          return (
            <li
              key={step}
              className={
                isLast
                  ? "flex shrink-0 items-center"
                  : "flex min-w-0 flex-1 items-center"
              }
            >
              <div
                className={`inline-flex shrink-0 flex-row items-center gap-1.5 rounded-full border-2 px-3 py-2 sm:gap-2 sm:px-3.5 sm:py-2.5 ${
                  active
                    ? "border-green-600 bg-green-600 text-white shadow-sm"
                    : done
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold sm:h-9 sm:w-9 sm:text-sm ${
                    active
                      ? "bg-white/25 text-white"
                      : done
                        ? "bg-green-600 text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <IconCheck className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
                  ) : (
                    step
                  )}
                </span>
                <span className="text-xs font-bold leading-snug whitespace-nowrap sm:text-sm">
                  {label}
                </span>
              </div>
              {!isLast ? (
                <span
                  className={`mx-1.5 h-0.5 min-w-3 flex-1 sm:mx-2 ${
                    done ? "bg-green-600" : "bg-slate-300"
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
