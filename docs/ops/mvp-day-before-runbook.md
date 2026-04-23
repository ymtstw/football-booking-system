# MVP 前日フロー運用メモ（1枚）

和歌山サッカー交流試合システムの **締切〜前日通知** を現場で迷わないための最短手順です。正本仕様は `docs/spec/implemented-behavior-catalog.md`（§1 締切・**§1.6** `locked` と再試行・§6 Cron）、`docs/spec/implemented-system-overview.md`。

## 前提

- **締切（標準）:** 開催の **2 日前 15:00 JST**（`reservation_deadline_at`。開催日作成時の既定。必要なら開催日ごとに変更可）
- **Cron（Vercel）:** `CRON_SECRET` がプロジェクトに入っていること（未設定だと Cron は 503）
- **メール:** `RESEND_API_KEY` / `RESEND_FROM` / `NEXT_PUBLIC_SITE_URL` が入っていること（無いと `notifications` が `pending` のまま）

## ざっくり順序

1. **JOB01 締切＋自動編成** … `open` かつ締切到達 → active **3 未満**なら `cancelled_minimum`＋最少中止メール／**3 以上**なら `locked` の直後に **午前補完・午後編成**まで実行し **`confirmed`** へ（Vercel の **2 本目 Cron は廃止**。手動リカバリ用に `GET /api/cron/run-matching-locked` は残す。**翌日以降の締切 Cron は `open` のみ再処理**するため、`locked` 滞留時の再編成は下表「編成のみ」または catalog **§1.6**）
2. **案内メール（Cron）** … **16:00 JST** 想定で **マッチング案内**（`matching_proposal`）。対象は **東京の今日+2 日**が `event_date` の開催のみ（開催前日の人には送らない）。予約サイトの案内は **17:00 まで**の到着目安＋前後注記
3. **SCR-11 前日確定結果一覧** … 管理画面で対戦・審判・ **warning** を確認。**SCR-12** で必要なら微修正（案内のあと・最終メールの前に実施）
4. **（任意）雨天判断** … **`/admin/event-days/{id}/weather`**。通常は **前日の一括最終メール（16:30 JST 頃バッチ）**に含める。荒天などは **即時確定＋即時メール**、または **前日一括で雨天中止文面**（API `delivery: day_before_17`）
5. **JOB03 前日最終メール** … 開催 **翌日（東京暦）** が `event_date` の行へ、予約代表メールで **確定＋雨天を1通**（**16:30 JST** 想定 Cron。予約サイトでは **17:30 まで**の到着目安＋前後注記）
6. **送信状況の確認** … **`/admin/event-days/{id}/notifications`**（サマリー・`notifications` 集計）

## 各ステップの入口

| 段階 | 自動（Cron） | 手動で同じことをする |
|------|----------------|----------------------|
| ロック＋編成（JOB01） | `GET /api/cron/lock-event-days`（UTC **`0 6`** ≒ JST **15:00**。同一リクエスト内で `locked` 後に自動編成まで） | 締切後も **`open` のまま**なら、**`/admin/event-days/{id}`（この開催のまとめ）→「例外（締切）」** から手動実行、または同等の `POST /api/admin/event-days/{id}/apply-deadline-catchup`（`acknowledged: true`。`locked` 時は編成まで実行）。**締切救済に `PATCH` の単純 `locked` は使わない**（最少催行分岐なし）。一覧に手動 locked ボタンは無し。 |
| 編成のみ（再実行・リカバリ） | —（定期 Cron からは外した） | `POST /api/admin/matching/run`（管理ログインまたは `CRON_SECRET`）、または手動で `GET /api/cron/run-matching-locked`（Bearer `CRON_SECRET`） |
| 案内メール | `GET /api/cron/send-matching-proposal`（UTC **`0 7`** ≒ JST **16:00**） | 同じ GET を **Bearer `CRON_SECRET`** で叩く（対象日は実装の「東京＋2日」条件に従う） |
| 結果確認 | — | **`/admin/pre-day-results?date=YYYY-MM-DD`** |
| 雨天 | — | **`/admin/event-days/{id}/weather`** |
| 前日最終 | `GET /api/cron/send-day-before-final`（UTC **`30 7`** ≒ JST **16:30**） | 同じ GET を **Bearer `CRON_SECRET`** で叩く（**対象は「東京の明日」開催のみ**） |
| 通知サマリー | — | **`/admin/event-days/{id}/notifications`** |

## 通知が失敗したとき

- **`notifications.status = failed`** を Supabase Table Editor または SQL で確認する（`error_message` に理由の断片）
- Resend のダッシュボードで配信ログを見る
- MVP では **自動再送なし**。必要なら同一内容の手動連絡または、失敗行を `pending` に戻してから再実行（運用判断）

## 関連ドキュメント

- **ローカルで Cron 相当を順実行:** `npm run cron:local-day-before`（手順: **`docs/ops/local-day-before-cron.md`**）
- 本番・環境のチェック項目: **`docs/ops/vercel-production-checklist.md`**
- 締切と状態: `docs/spec/implemented-behavior-catalog.md` §1・§2
- Cron 時刻の対応: 同ファイルの「Cron（Vercel）」表
