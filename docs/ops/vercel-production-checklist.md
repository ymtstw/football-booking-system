# Vercel 本番（および Preview）チェックリスト

リポジトリにデプロイしたあと、**本番 URL で最低限動く状態**にするための確認表です。値の入力は **Vercel Dashboard → Project → Settings → Environment Variables** で行います（値はチャットやスクリーンショットに載せない）。

## 1. 環境変数（必須）

| 変数名 | 用途 | メモ |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | Production に **本番用** Supabase を割り当てる |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ用 anon キー | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用（Route Handler） | **絶対に** `NEXT_PUBLIC_*` にしない |
| `CRON_SECRET` | Cron・`POST /api/admin/matching/run` の Bearer | **16 文字以上**のランダム文字列。Preview/Production それぞれ入れるか、方針を決める |
| `RESEND_API_KEY` | 予約完了・前日・即時雨天メール | 未設定だとメールは飛ばず `notifications` は `pending` のまま |
| `RESEND_FROM` | Resend の From | 例: `交流試合 <onboarding@resend.dev>` または検証済みドメイン |
| `NEXT_PUBLIC_SITE_URL` | メール内の予約管理リンクのベース | **末尾スラッシュなし**（例: `https://xxxx.vercel.app`） |

**変更後:** Environment Variables を変えたら **Redeploy**（`NEXT_PUBLIC_*` はビルド時埋め込みのため特に重要）。

## 2. Cron

- リポジトリの **`vercel.json`** に以下が含まれていること（UTC）:
  - `0 3 * * *` → `GET /api/cron/lock-event-days`
  - `1 3 * * *` → `GET /api/cron/run-matching-locked`
  - `30 4 * * *` → `GET /api/cron/send-day-before-final`
- Vercel のプランによっては **Cron が無効または制限**される場合がある。ダッシュボードの **Cron** タブで有効・直近実行ログを確認する。
- Cron リクエストには **`Authorization: Bearer <CRON_SECRET>`** が付与される（`CRON_SECRET` が未設定だと API は 503）。
- **ローカルで同じ 3 本を順実行:** `npm run cron:local-day-before`（`.env.local` と `npm run dev` が前提。詳細は **`docs/ops/local-day-before-cron.md`**）。

## 3. Supabase（本番）

- **本番プロジェクト**に migration を適用済みか（`supabase link` + `db push` または CI）
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

- サーバーログやクライアントに **`SUPABASE_SERVICE_ROLE_KEY`・`CRON_SECRET`・Resend キー・予約 token 平文**が出ていないか
- 利用者向け画面に **メール・電話の全文**が出ていないか（管理画面以外）

## 7. 運用フロー（前日まで）

短い手順は **`docs/ops/mvp-day-before-runbook.md`** を参照。
