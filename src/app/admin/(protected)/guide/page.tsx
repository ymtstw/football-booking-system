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
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${bar}`}
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
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-700"
          aria-hidden
        />
        <div className="relative pl-4 sm:pl-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">ガイド</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">運営ガイド</h1>
        </div>
      </header>

      <SectionCard id="about" title="このページについて">
        <p className="text-sm leading-relaxed text-zinc-700">
          このページでは、予約受付後から開催当日までに確認する内容をまとめています。
          細かい操作手順ではなく、運営上の確認ポイントを押さえるためのページです。
        </p>
      </SectionCard>

      <SectionCard id="first-checks" title="まず確認すること" accent="emphasis">
        <BulletList
          items={[
            "開催2日前15:00時点で、参加チームが3チーム以上あるか",
            "試合スケジュールが作成済みで、内容を確認したか",
            "昼食の数量に不自然な点がないか",
            "開催2日前16:00頃の案内前に、修正が必要な箇所が残っていないか",
            "開催前日16:30頃の最終案内前に、天候・施設の都合を確認したか",
            "当日の共有メモに、現場で共有すべき内容を書いたか",
            "特別な連絡が必要なチームがないか",
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
            timeLabel="開催2日前 15:00"
            title="予約の締切"
            body={
              <>
                この時点で参加チームが3チーム未満の場合は、原則として開催中止になります。
              </>
            }
          />
          <TimelineItem
            timeLabel="開催2日前 15:00〜16:00"
            title="締切直後の確認"
            body={
              <>
                締切後、参加チーム・昼食数・試合スケジュールを確認します。
                必要に応じて、試合スケジュールを手動で調整してください。
              </>
            }
          />
          <TimelineItem
            timeLabel="開催2日前 16:00"
            title="試合スケジュール案内の送信"
            body={<>送信の完了タイミングは、状況により数分ずれることがあります。</>}
          />
          <TimelineItem
            timeLabel="開催前日 16:30"
            title="前日の最終案内"
            body={<>天候・施設の都合・当日の注意事項を確認してください。</>}
          />
          <TimelineItem
            timeLabel="開催当日"
            title="現場運営"
            body={
              <>
                受付状況・昼食数・試合の進行・チーム間の確認事項を見ながら運営します。
                当日の注意点は「当日の共有メモ」に残してください。
              </>
            }
          />
        </div>
      </SectionCard>

      <SectionCard id="while-open" title="予約受付中に確認すること">
        <BulletList
          items={[
            "予約が入っている開催日を確認する",
            "参加チーム数が極端に少ない開催日がないか確認する",
            "昼食数に不自然な点がないか確認する",
            "予約内容に気になる点があれば、必要に応じてチームへ確認する",
            "開催日全体で共有したい注意点があれば、当日の共有メモに残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="two-days-before" title="開催2日前にやること">
        <h3 className="text-sm font-semibold text-zinc-900">15:00以降に確認</h3>
        <BulletList
          items={[
            "予約が締め切られているか",
            "参加チームが3チーム以上あるか",
            "3チーム未満の場合、開催中止の案内が必要か",
            "試合スケジュールが作成されているか",
            "午前・午後の試合内容に不自然な点がないか",
            "昼食の数量に不自然な点がないか",
            "特別な連絡が必要なチームがないか",
            "2日前16:00頃の案内前に、修正が必要な箇所がないか",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">参加チーム数の確認</h3>
        <BulletList
          items={[
            "3チーム以上の場合は、開催に向けて試合スケジュールと昼食数を確認する",
            "3チーム未満の場合は、原則として開催中止の対応を確認する",
            "判断に迷う場合は、すぐに運営責任者へ確認する",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">試合スケジュール確認時の注意</h3>
        <BulletList
          items={[
            "時刻の変更は、集合時間や試合時間に影響するため、原則として避ける",
            "やむを得ず変更する場合のみ調整する",
            "開催2日前16:30以降に時刻が変わる場合は、対象チームへメールなどで伝える",
            "対戦相手や審判に不自然な点がないか確認する",
            "調整した内容は、案内前にもう一度確認する",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">昼食確認時の注意</h3>
        <BulletList
          items={[
            "チームごとの昼食数に不自然な点がないか確認する",
            "参加人数と昼食数が大きくずれている場合は、必要に応じて確認する",
            "当日支払い・受け渡しで混乱しそうな点があれば、当日の共有メモに残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="before-mails" title="案内メール送信前に確認すること">
        <h3 className="text-sm font-semibold text-zinc-900">開催2日前16:00頃の案内前</h3>
        <BulletList
          items={[
            "試合スケジュールに修正漏れがないか",
            "集合時間や試合時刻に不自然な点がないか",
            "昼食数に確認漏れがないか",
            "開催中止にする必要がないか",
            "特別な連絡が必要なチームがないか",
            "送信後にお客様へ追加連絡が必要になりそうな変更が残っていないか",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">開催前日16:30頃の最終案内前</h3>
        <BulletList
          items={[
            "天候や施設の都合で開催できるか",
            "駐車場・集合時間・持ち物などの案内に不足がないか",
            "特別な連絡が必要なチームがないか",
            "当日の共有メモに、現場で確認すべき内容が残っているか",
          ]}
        />
      </SectionCard>

      <SectionCard id="day-before" title="開催前日にやること">
        <BulletList
          items={[
            "天候や施設の都合で、開催できるか確認する",
            "前日の最終案内の内容に問題がないか確認する",
            "駐車場・集合時間・持ち物などの案内に不足がないか確認する",
            "昼食数の最終確認が必要か確認する",
            "特別な連絡が必要なチームがないか確認する",
            "共有すべき注意点があれば、当日の共有メモに残す",
          ]}
        />
      </SectionCard>

      <SectionCard id="event-day" title="開催当日にやること">
        <BulletList
          items={[
            "参加チームの受付状況を確認する",
            "昼食の数量を確認する",
            "試合スケジュールを確認する",
            "審判・チーム間の確認事項を確認する",
            "遅刻・キャンセル・変更など、現場で共有すべき内容を確認する",
            "当日の変更や注意点は、当日の共有メモに残す",
            "当日判断した内容は、必要に応じて関係者へ共有する",
          ]}
        />
      </SectionCard>

      <SectionCard id="inquiries" title="問い合わせ対応">
        <BulletList
          items={[
            "未対応の案件・あとで再度確認が必要な案件は、画面上部の通知ベルに件数が表示されます",
            "「対応中」にすると、通知ベルの件数から外れます",
            "「対応済み」にする前に、必要な連絡や記録が残っていないか確認してください",
            "対応メモは管理者だけが見られるメモです",
            "お客様には表示・送信されません",
            "メールや電話で対応した内容は、必要に応じて対応メモに残してください",
            "次に確認することがある場合は、対応メモに残してください",
          ]}
        />
      </SectionCard>

      <SectionCard id="memos" title="メモの使い分け">
        <h3 className="text-sm font-semibold text-zinc-900">当日の共有メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          開催日全体に関するメモです。当日の運営、天候、駐車場、進行上の注意などを残します。
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">例</p>
        <BulletList
          items={[
            "雨予報のため前日夕方に再確認",
            "第2駐車場を優先案内",
            "到着が遅れる可能性のあるチームあり",
            "昼食の受け渡しに注意",
          ]}
        />
        <h3 className="mt-5 text-sm font-semibold text-zinc-900">対応メモ</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          お問い合わせや合宿相談ごとに、管理者用として残すメモです。電話対応、見積もりの確認中、次回連絡予定などを書きます。
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">例</p>
        <BulletList items={["電話済み", "見積もり確認中", "日程調整中", "次回連絡予定あり"]} />
        <div className="mt-5 rounded-xl border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
          <span className="font-semibold">注意</span>
          <span className="mx-1">：</span>
          どちらのメモも、お客様には表示・送信されません。
        </div>
      </SectionCard>

      <SectionCard id="mail-delivery" title="メール送信について">
        <BulletList
          items={[
            "管理画面で確認できる送信状況は、送信処理の結果を確認するためのものです",
            "相手のメール受信や開封を保証するものではありません",
            "メールが届いていない可能性がある場合は、必要に応じて電話や別の連絡手段でも確認してください",
            "重要な変更をした場合は、対象チームへ伝わっているか確認してください",
          ]}
        />
      </SectionCard>

      <SectionCard id="where-to-look" title="困ったときの確認先">
        <dl className="mt-1 space-y-4 text-sm">
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">開催日の確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              「開催運営」から、開催日ごとの状況・試合スケジュール・昼食数・共有メモを確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">予約内容の確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              「予約管理」から、チームごとの予約内容を確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">お問い合わせの確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              「対応案件」から、合宿相談・お問い合わせの対応状況を確認します。
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold text-zinc-900">各種設定の確認</dt>
            <dd className="mt-1.5 leading-relaxed text-zinc-700">
              「設定」から、開催枠・昼食メニューなどの設定を確認します。
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
