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

- **一般利用者:** ログインなし。予約はトークン URL で識別。
- **管理コンソール:** Supabase Auth のセッション + `app_admins` テーブルで管理者を判定（`getAdminUser()` 等）。未ログインは `/admin/login` へ。

## 外部 API（Route Handlers）

- **公開:** `src/app/api/reservations/**`、`event-days/**`、`camp-inquiries`、`tournament-inquiries`、`lunch-menu`（`eventDayId` で開催日別の有効昼食）等
- **管理:** `src/app/api/admin/**`（Bearer セッション Cookie 相当の仕組みは Next の仕様に従う）
- **Cron:** `src/app/api/cron/**`（`Authorization: Bearer ${CRON_SECRET}`）

一覧と期待挙動は [implemented-behavior-catalog.md](./implemented-behavior-catalog.md)。

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
- `docs/setup-staging-supabase.md` — ステージング Supabase
