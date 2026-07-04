import Link from "next/link";

/** フッター: お問い合わせ・合宿（管理者ログインは /admin/login を直接利用） */
export function ReservePublicFooter() {
  const phone =
    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "090-2901-0015";
  const hours =
    process.env.NEXT_PUBLIC_CONTACT_HOURS_JA?.trim() ||
    "9:00〜18:00";

  const cardClass =
    "rounded-[20px] border border-green-200 border-l-4 border-l-green-600 bg-green-50/80 p-3 pl-4 text-center shadow-sm sm:p-5 sm:pl-6 sm:text-left";

  return (
    <footer className="mt-auto border-t border-slate-200/70 bg-transparent">
      <div className="mx-auto grid max-w-[1280px] gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-8 md:px-8 md:py-12 lg:grid-cols-2 lg:gap-6 lg:px-10">
        <div className={cardClass}>
          <p className="text-base font-bold text-slate-900">お問い合わせ</p>
          <a
            href={`tel:${phone.replace(/-/g, "")}`}
            className="mt-0.5 block text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:mt-2"
          >
            {phone}
          </a>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600 sm:mt-2">{hours}</p>
          <Link
            href="/reserve/contact"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-green-700 underline underline-offset-2 hover:text-green-800 sm:mt-4"
          >
            お問い合わせへ
          </Link>
        </div>
        <div
          className={`${cardClass} bg-green-50/60`}
        >
          <p className="text-base font-bold text-slate-900">合宿のご相談</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-700 sm:mt-2">
            合宿のご希望は、専用フォームからお問い合わせください。
          </p>
          <Link
            href="/reserve/camp"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-green-700 underline underline-offset-2 hover:text-green-800 sm:mt-4"
          >
            合宿のご相談へ
          </Link>
        </div>
      </div>
    </footer>
  );
}
