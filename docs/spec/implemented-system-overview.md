# 実装システム概要

**対象読者:** 開発・テスト設計・運用がコードを追う前の俯瞰用。

## 技術スタック

| 層 | 採用 |
|----|------|
| Web | Next.js（App Router）・TypeScript・React（関数コンポーネント） |
| スタイル | Tailwind CSS |
| BaaS / DB | Supabase（PostgreSQL） |
| メール | Resend（通知は `notifications` 行経由） |
| ホスティング | Vercel（Cron は `vercel.json` 正本） |

## リポジトリの主要パス

| パス | 役割 |
|------|------|
| `src/app/` | App Router のページ・レイアウト・Route Handlers（`api/`） |
| `src/lib/` | 日付・締切既定・枠数ポリシー等の共有ユーティリティ |
| `src/domains/` | ドメインロジック（例: 編成 `matching/`） |
| `supabase/migrations/` | スキーマ・RPC・RLS の **DB 正本** |

## 認証

- **一般利用者:** ログインなし。予約の照会・変更・取消は **確認コード**（英数字の秘密。新規は短い形式、旧予約は従来の長い hex があり得る）を `GET/PATCH/POST /api/reservations/[token]` 等に渡して識別する。あわせて **予約番号**（`public_ref`・`RSV-` で始まる表示用ラベル）を発行するが、**予約番号だけでは予約を開けない**（詳細は [implemented-behavior-catalog.md](./implemented-behavior-catalog.md) §5.1）。
- **管理コンソール:** Supabase Auth のセッション + `app_admins` テーブルで管理者を判定（`getAdminUser()` 等）。未ログインは `/admin/login` へ。

## 外部 API（Route Handlers）

- **公開:** `src/app/api/reservations/**`、`event-days/**`、`camp-inquiries`、`tournament-inquiries`、`lunch-menu`（`eventDayId` で開催日別の有効昼食）等
- **管理:** `src/app/api/admin/**`（Bearer セッション Cookie 相当の仕組みは Next の仕様に従う）
- **Cron:** `src/app/api/cron/**`（`Authorization: Bearer ${CRON_SECRET}`）

一覧と期待挙動は [implemented-behavior-catalog.md](./implemented-behavior-catalog.md)。

## 一般向け予約画面（App Router・RSC）と公開 API

- **契約としての HTTP:** 外部・検証用途の正は引き続き **`GET /api/event-days`** などの Route Handler。応答の組み立ては **`src/lib/` の共有関数** に寄せている。
- **一覧（開催日）:** `GET /api/event-days` と **`/reserve/calendar`・`/reserve/schedule`** は同一の **`loadPublicEventDaysList()`** を使う。`acceptingReservations` や締切判定の意味は API と同一。
- **時刻依存:** 一覧・締切・受付可否は **`now()` 前提**のため、`/reserve/calendar` と `/reserve/schedule` のページには **`export const dynamic = "force-dynamic"`** を付与し、**静的ビルド時刻に値が固定されない**ようにしている（詳細は [implemented-behavior-catalog.md](./implemented-behavior-catalog.md) §1.3.1）。
- **日別:** `/reserve/[date]`（空き・昼食の初期取得）、`/reserve/schedule/[date]`（availability + public-schedule の bundle）は、それぞれ lib のローダーで **サーバー初期データ** を渡し、**ドメインルートの API と同じペイロード形**を維持する方針。

## Cron（Vercel）

スケジュールの **唯一の正本は `vercel.json`**（式は UTC）。

| スケジュール（UTC） | パス | 同日 JST目安 |
|---------------------|------|----------------|
| `0 6 * * *` | `/api/cron/lock-event-days` | 15:00 |
| `0 7 * * *` | `/api/cron/send-matching-proposal` | 16:00 |
| `30 7 * * *` | `/api/cron/send-day-before-final` | 16:30 |

※ `GET /api/cron/run-matching-locked` は **Vercel 定期実行からは外してある**（手動・ローカル連鎖用）。**`locked` のまま編成が未完の日**の再試行に使う想定。締切 Cron は `open` のみ拾うため、滞留対応は運用で本ルートを叩くか定期追加かを決める（[implemented-behavior-catalog.md](./implemented-behavior-catalog.md) §1.6）。

利用者向けの時刻表記は **`src/lib/copy/reserve-public-mail-schedule.ts`**（マッチング案内 **16:00頃**・前日最終 **16:30頃**＋到着の前後注記）と予約 UI で一致させる。

## パフォーマンス / キャッシュ（Disk IO 対策）

複数管理者が管理コンソールを同時に開くと、遷移ごとに同じ集計・一覧クエリが走り Supabase の Disk IO を消費する。**全管理者で共通の値**は Next.js の **`unstable_cache`（TTL 60 秒・サービスロールで取得）** で共有し、変更時に **`revalidateTag(tag, "max")`** で即時無効化する。キャッシュモジュールは **`import "server-only"`** で管理サーバ専用。

### キャッシュ対象と無効化タグ

| モジュール | 対象 | タグ | 無効化トリガー |
|-----------|------|------|----------------|
| `src/lib/admin/inquiry-count-cache.ts` | 問い合わせ件数（ベル・一覧タブ） | `admin-inquiry-counts` | 作成 `POST /api/camp-inquiries`・`/api/tournament-inquiries`、状態更新 `PATCH /api/admin/{camp,tournament}-inquiries/[id]` |
| `src/lib/admin/event-days-cache.ts` | 開催日一覧カレンダー（最大2000件・`getEventDaysCalendarCached`）／予約一覧の日付選択（最大400件・`getEventDaysDateOptionsCached`） | `admin-event-days` | 下表の「開催日 status / 存在」を変える操作 |
| `src/lib/event-days/public-reserve-cache.ts` | 公開 予約一覧（`getPublicEventDaysRawCached`・TTL60秒）／日付別空き状況（`getPublicAvailabilityCached`・TTL30秒） | `public-reserve` ＋ `admin-event-days` | 予約作成・取消、枠の編集・追加（強制含む）。開催日 status 変更は `admin-event-days` 経由で同時に無効化 |

### `admin-event-days` を無効化する操作

| 操作 | 経路 |
|------|------|
| 作成 | `POST /api/admin/event-days` |
| 公開 / 非公開 / 締切ロック | `PATCH /api/admin/event-days/[id]` |
| 締切リカバリ（手動・1日） | `POST /api/admin/event-days/[id]/apply-deadline-catchup`（`locked` / `cancelled_minimum` 発生時） |
| 削除 | `DELETE /api/admin/event-days/[id]` |
| 運営中止 / 復帰 | `POST .../operational-cancel` · `operational-restore` |
| 雨天判断（即時中止・復帰） | `POST .../weather-decision` |
| Cron 締切ロック / 最少催行中止 | `lock-event-days`（`locked` / `cancelled_minimum` 発生時のみ） |
| Cron 前日雨天の自動確定中止 | `send-day-before-final`（`cancelled_weather` 発生時のみ） |

### `public-reserve` を無効化する操作

公開の空き状況に影響する書き込みは、共通ヘルパー **`revalidatePublicReserveCaches()`**（`public-reserve` タグのみ）を呼ぶ。開催日 status を変える操作は上表の `admin-event-days` 無効化で公開キャッシュも同時に無効化される（公開キャッシュは両タグを付与）。

| 操作 | 経路 |
|------|------|
| 予約作成 | `POST /api/reservations` |
| 予約取消 | `POST /api/reservations/[token]/cancel` |
| 枠 編集 / 追加 | `PATCH` · `POST /api/admin/event-days/[id]/slots` |
| 枠 強制編集 / 強制追加 | `PATCH` · `POST /api/admin/event-days/[id]/slots/force` |
| 開催日 status 変更（公開・中止 等） | `admin-event-days` の各操作（上表）が公開キャッシュも無効化 |

### 方針・非対象

- **キャッシュ列は `id / event_date / grade_band / status` のみ**。`notes`・`slots`・昼食・`matching_proposal_notice_sent_at` はカレンダー表示に影響しないため無効化不要。マッチング実行は `event_days.status` を変えないため対象外。
- **変動値（予約人数・昼食数など）はキャッシュしない**（都度取得）。件数キャッシュは無効化で常に整合を保つ。
- **開催日ハブ（`/admin/event-days/[id]`）はキャッシュではなく、予約の2重読みを1回に統合**。`buildDashboardEventDaySummaryPayload` に事前取得予約を渡す `activeReservations` 引数を追加し、ハブは1回の予約取得を集計と昼食内訳で使い回す。ダッシュボード・`/api/admin/dashboard/next-event-day` は引数なしのままで挙動不変。
- **公開キャッシュは専用モジュール**（`public-reserve-cache.ts`）。取得時に `status` を明示フィルタするため `draft` は公開側に出ない。枠変更ヘルパーは `status` を変えないため `public-reserve` のみ無効化（`admin-event-days` は対象外）。
- **時刻依存の判定はキャッシュしない**。`acceptingReservations`・`bookable`（＝`open` かつ締切前）はキャッシュ後に**都度計算**するため、締切をまたいでも表示は正しい。定員・締切の整合は RPC（`create_public_reservation` / `cancel_public_reservation`）が行ロックで担保し、表示が古くても定員超過・締切後確定は起きない。

### 表示系の環境変数（連絡先）

- `NEXT_PUBLIC_CONTACT_PHONE`（既定 `090-2901-0015`）／`NEXT_PUBLIC_CONTACT_HOURS_JA`（既定 `9:00〜18:00`）。予約フッター・完了・お問い合わせ・予約管理の各画面で共通利用。未設定時は既定値にフォールバック。

## 仕様ドキュメントのマップ

| 文書 | 用途 |
|------|------|
| [mvp-product-intent.md](./mvp-product-intent.md) | 製品スコープの短文 |
| [implemented-behavior-catalog.md](./implemented-behavior-catalog.md) | テスト設計用の振る舞い一覧 |
| [implemented-matching-algorithm.md](./implemented-matching-algorithm.md) | 編成アルゴリズム詳細 |

## 運用ドキュメント（別ディレクトリ）

- `docs/ops/mvp-day-before-runbook.md` — 前日オペ手順
- `docs/ops/vercel-production-checklist.md` — 本番確認
- `docs/ops/admin-match-batch-patch-policy.md` — **手動調整の batch-patch 方針・セキュティ・eventDaySlotId の扱い**
- `docs/ops/release-gap-checklist-next-day.md` — **翌日実行向け・リリース漏れチェック手順（Git / DB / デプロイ / テスト）**
- `docs/setup-staging-supabase.md` — ステージング Supabase
