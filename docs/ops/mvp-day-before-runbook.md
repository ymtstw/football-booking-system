# MVP 前日フロー運用メモ（1枚）

和歌山サッカー交流試合システムの **締切〜前日通知** を現場で迷わないための最短手順です。正本仕様は `docs/spec/design-mvp.md` §5・§9、`docs/spec/reservation-deadline-and-event-status.md`。

## 前提

- **締切（標準）:** 開催の **2 日前 15:00 JST**（`reservation_deadline_at`。開催日作成時の既定。必要なら開催日ごとに変更可）
- **Cron（Vercel）:** `CRON_SECRET` がプロジェクトに入っていること（未設定だと Cron は 503）
- **メール:** `RESEND_API_KEY` / `RESEND_FROM` / `NEXT_PUBLIC_SITE_URL` が入っていること（無いと `notifications` が `pending` のまま）

## ざっくり順序

1. **JOB01 締切** … `open` かつ締切到達 → active **3 未満**なら `cancelled_minimum`＋最少中止メール／**3 以上**なら `locked`
2. **JOB02 自動編成** … `locked` → 午前補完・午後編成 → **`confirmed`**
3. **案内メール（Cron）** … **16:30 JST** 想定で **マッチング案内**（`matching_proposal`）。参加者に「案」を送ったうえで運営が確認する前提
4. **SCR-11 前日確定結果一覧** … 管理画面で対戦・審判・ **warning** を確認。**SCR-12** で必要なら微修正（案内のあと・最終メールの前に実施）
5. **（任意）雨天判断** … **`/admin/event-days/{id}/weather`**。通常は **前日 17:00 の最終メール**に含める。荒天などは **即時確定＋即時メール**、または **「前日17:00に雨天中止文面」予約**（API `delivery: day_before_17`）
6. **JOB03 前日最終メール** … 開催 **翌日（東京暦）** が `event_date` の行へ、予約代表メールで **確定＋雨天を1通**（**17:00 JST** 想定 Cron）
7. **送信状況の確認** … **`/admin/event-days/{id}/notifications`**（サマリー・`notifications` 集計）

## 各ステップの入口

| 段階 | 自動（Cron） | 手動で同じことをする |
|------|----------------|----------------------|
| ロック | `GET /api/cron/lock-event-days`（UTC **`0 6`** ≒ JST **15:00**） | 管理の開催日が `open` のとき `PATCH` で `locked`（締切後のみ） |
| 編成 | `GET /api/cron/run-matching-locked`（UTC **`1 6`** ≒ JST **15:01**） | `POST /api/admin/matching/run` + `CRON_SECRET` または管理ログイン |
| 案内メール | `GET /api/cron/send-matching-proposal`（UTC **`30 7`** ≒ JST **16:30**） | 同じ GET を **Bearer `CRON_SECRET`** で叩く（対象日は実装の「東京＋2日」条件に従う） |
| 結果確認 | — | **`/admin/pre-day-results?date=YYYY-MM-DD`** |
| 雨天 | — | **`/admin/event-days/{id}/weather`** |
| 前日最終 | `GET /api/cron/send-day-before-final`（UTC **`0 8`** ≒ JST **17:00**） | 同じ GET を **Bearer `CRON_SECRET`** で叩く（**対象は「東京の明日」開催のみ**） |
| 通知サマリー | — | **`/admin/event-days/{id}/notifications`** |

## 通知が失敗したとき

- **`notifications.status = failed`** を Supabase Table Editor または SQL で確認する（`error_message` に理由の断片）
- Resend のダッシュボードで配信ログを見る
- MVP では **自動再送なし**。必要なら同一内容の手動連絡または、失敗行を `pending` に戻してから再実行（運用判断）

## 関連ドキュメント

- **ローカルで Cron 相当を順実行:** `npm run cron:local-day-before`（手順: **`docs/ops/local-day-before-cron.md`**）
- 本番・環境のチェック項目: **`docs/ops/vercel-production-checklist.md`**
- 締切と状態: `docs/spec/reservation-deadline-and-event-status.md`
- Cron 時刻の対応: 同ファイルの「Cron（Vercel）」表
