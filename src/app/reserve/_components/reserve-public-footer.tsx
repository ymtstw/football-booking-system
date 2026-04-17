import Link from "next/link";

import { IconHome, IconLock, IconPhone } from "./reserve-icons";

/** フッター: お問い合わせ・合宿・管理者（仕様 4-7） */
export function ReservePublicFooter() {
  const phone =
    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "04-1234-5678";
  const hours =
    process.env.NEXT_PUBLIC_CONTACT_HOURS_JA?.trim() ||
    "平日 9:00〜17:00（祝日除く）";

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 py-10 md:px-8 md:py-12 lg:grid-cols-3 lg:gap-6 lg:px-10">
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-green-200 bg-green-50/80 p-5 text-center shadow-sm sm:items-start sm:text-left">
          <span className="shrink-0 text-green-800">
            <IconPhone className="h-10 w-10" strokeWidth={2} />
          </span>
          <div className="w-full">
            <p className="text-base font-bold text-slate-900">お問い合わせ</p>
            <a
              href={`tel:${phone.replace(/-/g, "")}`}
              className="mt-2 block text-2xl font-extrabold tabular-nums tracking-tight text-slate-900"
            >
              {phone}
            </a>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{hours}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-green-200 bg-green-50/60 p-5 text-center shadow-sm sm:items-start sm:text-left">
          <span className="shrink-0 text-green-800">
            <IconHome className="h-10 w-10" strokeWidth={2} />
          </span>
          <div className="w-full">
            <p className="text-base font-bold text-slate-900">合宿のご相談</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              宿泊を伴う合宿のご希望は、専用フォームからお問い合わせください。
            </p>
            <Link
              href="/reserve/camp"
              className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-green-700 underline underline-offset-2 hover:text-green-800"
            >
              合宿のご相談へ
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm sm:items-stretch">
          <Link
            href="/admin/login"
            className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[16px] border-2 border-green-700 bg-white px-4 text-sm font-bold text-green-800 shadow-sm transition-colors hover:bg-green-50"
          >
            <IconLock className="h-5 w-5 shrink-0" strokeWidth={2} />
            管理者ログイン
          </Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} 小学生サッカー対戦予約
      </p>
    </footer>
  );
}
