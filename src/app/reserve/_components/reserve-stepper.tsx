import { IconCheck } from "./reserve-icons";

/** 予約フロー用ステッパー（仕様 3-2: 丸数字 + ラベル + 横ライン） */
export type ReserveFlowStep = 1 | 2 | 3 | 4;

const STEPS: { step: ReserveFlowStep; label: string }[] = [
  { step: 1, label: "予約" },
  { step: 2, label: "開催日を選ぶ" },
  { step: 3, label: "予約情報の入力" },
  { step: 4, label: "完了" },
];

export function ReserveStepper({ current }: { current: ReserveFlowStep }) {
  return (
    <nav aria-label="予約の進行状況" className="mb-8 sm:mb-10">
      <ol className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2.5 sm:flex-nowrap sm:justify-center sm:gap-x-0 sm:gap-y-0">
        {STEPS.map(({ step, label }, i) => {
          const done = step < current;
          const active = step === current;
          return (
            <li
              key={step}
              className="flex max-w-full flex-none items-center sm:min-w-0 sm:flex-1"
            >
              <div
                className={`inline-flex max-w-[min(100vw-2rem,20rem)] flex-row items-center gap-2 rounded-full border-2 px-3 py-2 sm:max-w-none sm:px-4 sm:py-2.5 ${
                  active
                    ? "border-green-600 bg-green-600 text-white shadow-sm"
                    : done
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold sm:h-9 sm:w-9 ${
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
                <span className="min-w-0 text-xs font-bold leading-snug break-keep sm:shrink-0 sm:whitespace-nowrap sm:text-sm">
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span
                  className={`mx-1 hidden h-0.5 min-w-2 shrink-0 sm:block sm:min-w-0 sm:flex-1 ${
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
