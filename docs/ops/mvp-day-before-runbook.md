# MVP 前日フロー運用メモ（1枚）

和歌山サッカー交流試合システムの **締切〜前日通知** を現場で迷わないための最短手順です。正本仕様は `docs/spec/design-mvp.md` §9・`docs/spec/reservation-deadline-and-event-status.md`。

## 前提

- **締切（標準）:** 開催前日 **12:00 JST**（`reservation_deadline_at` が過ぎた `open` が `locked` になる）
- **Cron（Vercel）:** `CRON_SECRET` がプロジェクトに入っていること（未設定だと Cron は 503）
- **メール:** `RESEND_API_KEY` / `RESEND_FROM` / `NEXT_PUBLIC_SITE_URL` が入っていること（無いと `notifications` が `pending` のまま）

## ざっくり順序

1. **JOB01 締切ロック** … `open` かつ締切過ぎ → `locked`
2. **JOB02 自動編成** … `locked` → 午前補完・午後編成 → **`confirmed`**
3. **SCR-11 前日確定結果一覧** … 管理画面で対戦・審判・ **warning** を確認
4. **（任意）雨天判断** … 中止なら登録。通常は **前日 13:30 のメールに含める**。荒天のみ **即時メール**可
5. **JOB03 前日最終メール** … 開催 **翌日（東京暦）** が `event_date` の行へ、予約代表メールで **確定＋雨天を1通**

## 各ステップの入口

| 段階 | 自動（Cron） | 手動で同じことをする |
|------|----------------|----------------------|
| ロック | `GET /api/cron/lock-event-days`（UTC `0 3` ≒ JST 12:00） | 管理の開催日が `open` のとき `PATCH` で `locked`（締切後のみ） |
| 編成 | `GET /api/cron/run-matching-locked`（UTC `1 3` ≒ JST 12:01） | `POST /api/admin/matching/run` + `CRON_SECRET` または管理ログイン |
| 結果確認 | — | **`/admin/pre-day-results?date=YYYY-MM-DD`** |
| 雨天 | — | **`/admin/event-days/{id}/weather`** |
| 前日メール | `GET /api/cron/send-day-before-final`（UTC `30 4` ≒ JST 13:30） | 同じ GET を **Bearer `CRON_SECRET`** で叩く（**対象は「東京の明日」開催のみ**） |

## 通知が失敗したとき

- **`notifications.status = failed`** を Supabase Table Editor または SQL で確認する（`error_message` に理由の断片）
- Resend のダッシュボードで配信ログを見る
- MVP では **自動再送なし**。必要なら同一内容の手動連絡または、失敗行を `pending` に戻してから再実行（運用判断）

## 関連ドキュメント

- **ローカルで JOB01〜03 を一括実行:** `npm run cron:local-day-before`（手順: **`docs/ops/local-day-before-cron.md`**）
- 本番・環境のチェック項目: **`docs/ops/vercel-production-checklist.md`**
- 締切と状態: `docs/spec/reservation-deadline-and-event-status.md`
- Cron 時刻の対応: 同ファイルの「Cron（Vercel）」表
