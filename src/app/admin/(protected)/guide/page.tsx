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

      <SectionCard id="first-checks" title="まず確認すること" accent="emphasis">
        <BulletList
          items={[
            "参加チームが3チーム以上あるか",
            "試合スケジュールに不自然な点がないか",
            "昼食数に不自然な点がないか",
            "送信エラーがないか（ある場合は対応が必要）",
            "天候・施設状況に問題がないか",
            "当日の共有メモに必要な内容が残っているか",
          ]}
        />
      </SectionCard>

      <SectionCard id="schedule" title="通常の運営スケジュール">
        <div className="space-y-0 pt-1">
          <TimelineItem
            timeLabel="予約受付中"
            body={<>予約内容・参加チーム数・昼食数を、必要に応じて確認します。</>}
          />
          <TimelineItem
            timeLabel="開催2日前 15:00以降"
            body={
              <>
                予約締切後に、参加チーム数・試合スケジュール・昼食数を確認します。
                <br />
                参加チームが3チーム未満の場合は、原則として開催中止になります。
              </>
            }
          />
          <TimelineItem
            timeLabel="開催2日前 16:00頃"
            body={
              <>
                試合スケジュール案内の送信状況を確認します。
                <br />
                送信エラーがあれば、必要に応じて対応します。
              </>
            }
          />
          <TimelineItem
            timeLabel="開催前日 16:30頃"
            body={<>天候・施設状況を確認し、前日最終案内の送信状況を確認します。</>}
          />
          <TimelineItem
            timeLabel="開催当日"
            body={
              <>
                受付状況・試合進行・昼食数を確認し、必要事項を関係者へ共有します。
              </>
            }
          />
        </div>
      </SectionCard>

      <SectionCard id="while-open" title="予約受付中に確認すること">
        <BulletList
          items={[
            "予約チーム数を必要に応じて確認する",
            "昼食数に不自然な点がないか確認する",
            "気になる予約内容があれば確認する",
            "共有が必要な内容は「当日の共有メモ」に残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="two-days-before" title="開催2日前に確認すること">
        <BulletList
          items={[
            "予約が締め切られているか確認する",
            "参加チームが3チーム以上あるか確認する",
            "3チーム未満の場合は、中止案内の送信状況を確認する",
            "試合スケジュールと昼食数の全体を確認する",
            "特別な連絡が必要なチームがないか確認する",
          ]}
        />
      </SectionCard>

      <SectionCard id="match-schedule-notes" title="試合スケジュール確認時の注意">
        <BulletList
          items={[
            "対戦相手に不自然な点がないか",
            "審判に不自然な点がないか",
            "時刻に不自然な点がないか",
            "必要があれば、案内前に修正する",
            "時刻を変更する場合は、集合時間や案内内容に影響がないか確認する",
          ]}
        />
      </SectionCard>

      <SectionCard id="lunch-notes" title="昼食確認時の注意">
        <BulletList
          items={[
            "チーム別の昼食数を確認する",
            "参加人数と昼食数が大きくずれている場合は、必要に応じて確認する",
            "当日混乱しそうな点は「当日の共有メモ」に残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="before-mails" title="案内メール送信前に確認すること">
        <BulletList
          items={[
            "試合スケジュールに修正漏れがないか",
            "特別な連絡が必要なチームがないか",
            "送信後に追加連絡が必要になりそうな変更が残っていないか",
          ]}
        />
      </SectionCard>

      <SectionCard id="day-before" title="開催前日に確認すること">
        <BulletList
          items={[
            "天候・施設状況を確認する",
            "駐車場・持ち物などの案内に不足がないか確認する",
            "当日共有すべき内容を「当日の共有メモ」に残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="event-day" title="開催当日に確認すること">
        <BulletList
          items={[
            "受付状況を確認する",
            "試合進行を確認する",
            "昼食数を確認する",
            "共有メモを確認する",
            "遅刻・キャンセル・変更があれば関係者へ共有する",
          ]}
        />
      </SectionCard>

      <SectionCard id="inquiries" title="問い合わせ対応">
        <BulletList
          items={[
            "未対応・確認が必要な問い合わせがないか確認する",
            "必要に応じて対応状況を更新する",
            "電話やメールで対応した内容は、必要に応じて対応メモに残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="memos" title="メモの使い分け">
        <h3 className="text-sm font-semibold text-zinc-900">当日の共有メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          開催日全体で共有したい内容を残します。
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">例</p>
        <BulletList items={["天候注意", "駐車場案内", "遅刻予定", "昼食受け渡し注意"]} />

        <h3 className="mt-5 text-sm font-semibold text-zinc-900">対応メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          問い合わせや相談ごとの管理者用メモです。お客様には表示されません。
        </p>
      </SectionCard>

      <SectionCard id="mail-delivery" title="メール送信について">
        <BulletList
          items={[
            "送信状況は、メール送信処理の結果です",
            "相手が受信・確認したことを保証するものではありません",
            "送信エラーがある場合は、メールアドレス確認や個別連絡を検討してください",
            "重要な変更をした場合は、対象チームへ伝わっているか確認してください",
          ]}
        />
      </SectionCard>

      <SectionCard id="where-to-look" title="困ったときの確認先">
        <dl className="mt-1 space-y-4 text-sm">
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">開催日の確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              開催日ごとの状況・試合スケジュール・昼食数・共有メモを確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">予約内容の確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              チームごとの予約内容を確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">お問い合わせの確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              問い合わせの対応状況を確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">メール送信履歴</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              送信状況と送信エラーの有無を確認します。
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
