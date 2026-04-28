# Vercel 本番（および Preview）チェックリスト

リポジトリにデプロイしたあと、**本番 URL で最低限動く状態**にするための確認表です。値の入力は **Vercel Dashboard → Project → Settings → Environment Variables** で行います（値はチャットやスクリーンショットに載せない）。

**ホスト構成（本番 Web / ステージング Web / メール送信用サブドメイン）** の方針は **`docs/setup-staging-supabase.md`**（サブドメイン例）および **`docs/spec/mvp-product-intent.md`** を参照する。`NEXT_PUBLIC_SITE_URL` は **Production と Preview（または Staging 割当）で、それぞれ実際にブラウザで開く Web ホスト**に一致させる（本番とステージングで値が違って当然）。

## 1. 環境変数（必須）

| 変数名 | 用途 | メモ |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | Production に **本番用** Supabase を割り当てる |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ブラウザ用 Publishable キー | 同上 |
| `SUPABASE_SECRET_KEY` | サーバー専用（Route Handler・Secret） | **絶対に** `NEXT_PUBLIC_*` にしない |
| `CRON_SECRET` | Cron・`POST /api/admin/matching/run` の Bearer | **16 文字以上**のランダム文字列。Preview/Production それぞれ入れるか、方針を決める |
| `RESEND_API_KEY` | 予約完了・前日・即時雨天メール | 未設定だとメールは飛ばず `notifications` は `pending` のまま |
| `RESEND_FROM` | Resend の From | 例: `交流試合 <onboarding@resend.dev>` または **検証済み送信用サブドメイン**（設計例: `updates.<apex>`。Web 本番ホストとは別子ドメインを推奨） |
| `NEXT_PUBLIC_SITE_URL` | メール内の予約管理リンクのベース | **末尾スラッシュなし**。カスタムドメイン運用なら本番・ステージングそれぞれの Web ホスト（§1-5）。暫定なら `https://xxxx.vercel.app` も可 |

**変更後:** Environment Variables を変えたら **Redeploy**（`NEXT_PUBLIC_*` はビルド時埋め込みのため特に重要）。

## 2. Cron

- リポジトリの **`vercel.json`** に以下が含まれていること（UTC。JST は UTC+9）:
  - `0 6 * * *` → `GET /api/cron/lock-event-days`（同日 **15:00** JST。`locked` になった開催は **同一リクエスト内で自動編成まで**実行）
  - `0 7 * * *` → `GET /api/cron/send-matching-proposal`（**16:00** JST。予約サイトでは利用者向けに **17:00 まで**の目安で案内）
  - `30 7 * * *` → `GET /api/cron/send-day-before-final`（**16:30** JST。利用者向けに **17:30 まで**の目安で案内。マッチング案内と 30 分ずらし）
- Vercel のプランによっては **Cron が無効または制限**される場合がある。ダッシュボードの **Cron** タブで有効・直近実行ログを確認する。
- Cron リクエストには **`Authorization: Bearer <CRON_SECRET>`** が付与される（`CRON_SECRET` が未設定だと API は 503）。
- **ローカルで同じ 3 本を順実行:** `npm run cron:local-day-before`（`.env.local` と `npm run dev` が前提。詳細は **`docs/ops/local-day-before-cron.md`**）。
- **`locked` 滞留時:** 締切 Cron は翌日以降 **`open` の行しか再処理しない**。編成が未完で `locked` が残る場合は、運用で **`GET /api/cron/run-matching-locked`**（手動または定期の要否を決める）や管理の編成実行でリカバリする（仕様: **`docs/spec/implemented-behavior-catalog.md` §1.6**）。

## 3. Supabase（本番）

- **本番プロジェクト**に migration を適用済みか（`supabase link` + `db push` または CI）
- **DB バックアップ:** 自動バックアップの有無・保持期間を Dashboard で確認し、大きなマイグレーション前は手動スナップショットや `pg_dump` 等で退避する。**運用方針:** Supabase ダッシュボードのバックアップ設定を正とする。
- **Auth:** 管理者用ユーザーを 1 人以上作成
- **`app_admins`:** そのユーザーの `auth.users.id` を `INSERT INTO public.app_admins (user_id) VALUES ('…');` で登録（Role: postgres / SQL Editor）。手順の詳細は `docs/progress.md` の「A. 運用・Supabase」または `docs/setup-staging-supabase.md` の Auth 周りを参照（Staging 用だが手順は同型）。

## 4. Resend

- API キーを本番環境に登録済みか
- 本番 From 用に **独自ドメイン検証**を終えているか（任意だが推奨）。手順の例: `docs/setup-resend-domain.md`

## 5. デプロイ直後のスモークテスト

1. ブラウザで **本番 URL** のトップが開くか
2. **`/admin/login`** で管理者ログインできるか
3. **`/admin/event-days`** が開くか
4. （任意）**Preview** に Staging Supabase を割り当てている場合、誤って本番 DB を触っていないか

## 6. ログ・秘密情報

- サーバーログやクライアントに **`SUPABASE_SECRET_KEY`・`CRON_SECRET`・Resend キー・予約確認コードの平文**が出ていないか
- 利用者向け画面に **メール・電話の全文**が出ていないか（管理画面以外）

## 7. 運用フロー（前日まで）

短い手順は **`docs/ops/mvp-day-before-runbook.md`** を参照。
