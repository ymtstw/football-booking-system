import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "運営ガイド",
};

/** 箇条書き（現場向け・短文） */
function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-800 marker:text-emerald-700">
      {items.map((t, i) => (
        <li key={`${i}-${t.slice(0, 48)}`} className="min-w-0">
          {t}
        </li>
      ))}
    </ul>
  );
}

function SectionCard({
  title,
  id,
  accent = "default",
  children,
}: {
  title: string;
  id: string;
  accent?: "default" | "emphasis" | "warn";
  children: React.ReactNode;
}) {
  const shell =
    accent === "emphasis"
      ? "border-emerald-300 bg-gradient-to-br from-emerald-50/95 to-white shadow-md ring-2 ring-emerald-200/90"
      : accent === "warn"
        ? "border-amber-200 bg-amber-50/60 shadow-sm"
        : "border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100/80";

  const bar =
    accent === "emphasis"
      ? "from-emerald-500 to-emerald-700"
      : accent === "warn"
        ? "from-amber-400 to-amber-600"
        : "from-emerald-500 to-emerald-700";

  return (
    <section
      id={id}
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5 ${shell}`}
      aria-labelledby={`${id}-heading`}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-linear-to-b ${bar}`}
        aria-hidden
      />
      <h2
        id={`${id}-heading`}
        className="relative pl-3 text-base font-bold tracking-tight text-zinc-900 sm:text-lg"
      >
        {title}
      </h2>
      <div className="relative mt-3 pl-3">{children}</div>
    </section>
  );
}

/** 時系列（スケジュール） */
function TimelineItem({
  timeLabel,
  title,
  body,
}: {
  timeLabel: string;
  title?: string;
  body: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3 border-l-2 border-emerald-200 pb-6 pl-4 last:border-transparent last:pb-0">
      <span
        className="absolute -left-[9px] top-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-white bg-emerald-600 shadow-sm ring-1 ring-emerald-700/20"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{timeLabel}</p>
        {title ? <p className="text-sm font-semibold text-zinc-900">{title}</p> : null}
        <div className="text-sm leading-relaxed text-zinc-700">{body}</div>
      </div>
    </div>
  );
}

export default async function AdminGuidePage() {
  if (!(await getAdminUser())) {
    redirect("/admin/login");
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-md ring-1 ring-zinc-100 sm:p-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-emerald-500 to-emerald-700"
          aria-hidden
        />
        <div className="relative pl-4 sm:pl-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">ガイド</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">運営ガイド</h1>
        </div>
      </header>

      <SectionCard id="about" title="このページについて">
        <p className="text-sm leading-relaxed text-zinc-700">
          予約受付後から開催当日までに、確認することを時系列でまとめています。
          細かい操作手順ではなく、「いつ・何を確認するか」を見るためのページです。
        </p>
      </SectionCard>

      <SectionCard id="ops" title="運用担当者がやること" accent="emphasis">
        <div className="space-y-0 pt-1">
          <TimelineItem
            timeLabel="予約受付中"
            body={
              <BulletList
                items={[
                  "予約チーム数を確認する",
                  "昼食数を確認する",
                  "気になる予約内容があれば確認する",
                  "共有が必要な内容は「当日の共有メモ」に残す",
                ]}
              />
            }
          />
          <TimelineItem
            timeLabel="開催2日前 15:00"
            body={
              <BulletList
                items={[
                  "予約が締め切られているか確認する",
                  "参加チームが3チーム以上あるか確認する",
                  "3チーム未満の場合は、中止案内を確認する",
                ]}
              />
            }
          />
          <TimelineItem
            timeLabel="開催2日前 15:00〜16:00"
            body={
              <BulletList
                items={[
                  "試合スケジュールを確認する",
                  "対戦相手、審判、時刻に不自然な点がないか確認する",
                  "チーム別の昼食数を確認する",
                  "必要があれば、案内前に修正する",
                ]}
              />
            }
          />
          <TimelineItem
            timeLabel="開催2日前 16:00頃"
            body={
              <BulletList
                items={[
                  "試合スケジュール案内の送信状況を確認する",
                  "送信エラーがあれば、メールアドレス確認や個別連絡を行う",
                ]}
              />
            }
          />
          <TimelineItem
            timeLabel="開催前日 16:30頃"
            body={
              <BulletList
                items={[
                  "天候、施設状況、駐車場、持ち物を確認する",
                  "前日最終案内の送信状況を確認する",
                  "当日共有すべき内容を「当日の共有メモ」に残す",
                ]}
              />
            }
          />
          <TimelineItem
            timeLabel="開催当日"
            body={
              <BulletList
                items={[
                  "受付状況を確認する",
                  "試合進行を確認する",
                  "昼食数を確認する",
                  "共有メモを確認する",
                  "遅刻、キャンセル、変更があれば関係者へ共有する",
                ]}
              />
            }
          />
        </div>
      </SectionCard>

      <SectionCard id="exceptions" title="例外対応" accent="warn">
        <h3 className="text-sm font-semibold text-zinc-900">3チーム未満の場合</h3>
        <BulletList
          items={[
            "原則として開催中止",
            "中止案内が送られているか確認する",
            "必要に応じて個別連絡する",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">天候による中止の場合</h3>
        <BulletList
          items={[
            "天候対応を登録する",
            "判断理由や注意事項をメモに残す",
            "必要に応じてメールや電話で連絡する",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">運営都合による中止の場合</h3>
        <BulletList
          items={[
            "緊急中止を登録する",
            "参加者向けのお知らせを入力する",
            "振替、返金、連絡方法など、次に必要な案内を明記する",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">メール送信エラーの場合</h3>
        <BulletList
          items={[
            "対象チームのメールアドレスを確認する",
            "誤りがあれば修正する",
            "重要な案内は、必要に応じて電話でも確認する",
          ]}
        />
      </SectionCard>

      <SectionCard id="notes-and-mail" title="メモ・メールの注意">
        <h3 className="text-sm font-semibold text-zinc-900">当日の共有メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          開催日全体で共有したい内容を残します。
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">例</p>
        <BulletList
          items={[
            "天候注意",
            "駐車場案内",
            "遅刻予定",
            "昼食受け渡し注意",
          ]}
        />

        <h3 className="mt-5 text-sm font-semibold text-zinc-900">対応メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          問い合わせや相談ごとの管理者用メモです。お客様には表示されません。
        </p>

        <h3 className="mt-5 text-sm font-semibold text-zinc-900">メール送信について</h3>
        <BulletList
          items={[
            "送信状況は、メールを送る処理の結果です",
            "相手が受信・確認したことを保証するものではありません",
            "重要な変更は、必要に応じて電話などでも確認してください",
          ]}
        />
      </SectionCard>
    </div>
  );
}
