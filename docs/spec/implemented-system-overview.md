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

利用者向けの「○時までに届く目安」は **`src/lib/copy/reserve-public-mail-schedule.ts`**（案内 **17:00** まで・前日 **17:30** まで＋前後注記）と予約 UI で一致させる。

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
- `docs/setup-staging-supabase.md` — ステージング Supabase
