# ローカルで前日フロー（Cron 相当）を試す

Vercel の Cron は **本番 URL にしか飛びません**。ローカルでロック → 編成 → 案内 → 前日メールまで試すには、次のどちらかです。

- **`npm run cron:local-day-before`** … 下記スクリプトで **JOB01 → JOB02 → 案内 → JOB03** を **順に** `GET` する（開発サーバーが起動している必要あり）
- 手動で同じ URL を `curl` + `Authorization: Bearer $CRON_SECRET` で叩く（運用は `docs/ops/mvp-day-before-runbook.md`）

## あなたが用意するもの（`.env.local`）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB（ローカル Supabase なら `supabase status` の API URL） |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron ルートがサービスロールで DB にアクセス |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 管理画面・予約画面など（Cron 本体には必須ではないが通常は入れる） |
| `CRON_SECRET` | **16 文字以上**。Cron API の `Authorization: Bearer` と一致させる |
| `RESEND_API_KEY` / `RESEND_FROM` | **実メールまで試すとき必須**。無いとメール系ジョブは送信をスキップし `pending` のままになり得る |
| `NEXT_PUBLIC_SITE_URL` | メール内「予約確認」リンク（例: `http://localhost:3000`） |

任意:

| 変数 | 用途 |
|------|------|
| `LOCAL_CRON_BASE_URL` | 既定 `http://localhost:3000`。`next dev -p 3001` なら `http://localhost:3001` |

`.env.example` に同名でテンプレあり。

## 手順（最短）

1. **Supabase を起動**（ローカル DB なら `npm run db:start` など、いつも通り）
2. **マイグレーション**が当たっていること（`npm run db:push:local` 等）
3. **別ターミナルで** `npm run dev`（`LOCAL_CRON_BASE_URL` と同じオリジン）
4. 開催日・締切・予約データを整える  
   - JOB01 は `status = open` かつ **`reservation_deadline_at <= 実行時刻`** の行を処理（3 未満なら最少中止）  
   - 案内 Cron は **東京暦で「今日+2日」** が `event_date` の locked/confirmed 等を対象（`send-matching-proposal` の実装どおり）  
   - 前日メール JOB03 は **実行時の「東京の今日」の翌日** が `event_date` の行だけが対象（`send-day-before-final` の実装どおり）
5. 対象日の前日（例: 開催 **4/17** なら東京暦 **4/16**）に、マシンの時計が合っている状態で:

```bash
npm run cron:local-day-before
```

環境だけ確認:

```bash
npm run cron:local-day-before -- --check
```

## 注意

- **日付をずらしたいだけ**のテストでは、JOB03・案内 Cron はサーバー側の **東京の「今日」** に依存するため、**カレンダー上の前日に実行する**か、データと締切をその前提に合わせる必要があります。
- Resend の **検証済みドメイン / From** が整っていないと、本番以外では送信失敗やスパム扱いになることがあります（`docs/setup-resend-domain.md`）。
