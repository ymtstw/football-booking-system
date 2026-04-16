# 予約締切と `event_days.status`（仕様）

## 方針（正本）

本システムでは、**予約受付の可否は `reservation_deadline_at`（DB: `timestamptz`）とサーバー時刻 `now()` の比較**により判定する。締切を過ぎた場合は、**新規予約・内容変更・取消はできない**。

一方、`event_days.status` の **`locked` への遷移は、締切の「瞬間」に DB が自動反転する挙動ではない**。業務用の状態として、**手動（管理 PATCH）または Cron がまとめて** `open` → `locked` に更新する。Cron は **`reservation_deadline_at` を過ぎた `open` 行**を対象とする（予約 RPC の締切判定と同様に **`<= now()`** 相当）。

**運用既定の締切時刻:** 開催日の **2 日前 15:00（Asia/Tokyo）**。開催日作成時に `reservation_deadline_at` に入る ISO の算出は `src/lib/dates/reservation-deadline-default.ts` を正とする。必要に応じて開催日ごとに別の `timestamptz` を保存してよい。

**締切 Cron（JOB01）の追加挙動:** 締切時点で **active 予約が表すチーム数が 3 未満**のときは `cancelled_minimum` とし、**最少催行不足の即時通知**（テンプレ `minimum_cancel_notice`）を送る。3 チーム以上のとき従来どおり `locked` とする。

## 補足（`open` でない場合）

**締切前であっても** `event_days.status` が **`open` でない**場合は、新規予約・変更・取消を受け付けない（例: 下書き、締切前の早期ロック、確定後など）。

## 開催中止ステータス（掲示）

| 値 | 意味（MVP） |
|----|-------------|
| `cancelled_weather` | **雨天・天候**などで開催中止にした日。 |
| `cancelled_minimum` | **最少催行（参加チーム数や人数の下限）を満たさず**開催できないと判断した日。雨天中止と理由を分けて記録・表示する。 |

一般向けカレンダーでは上記も **日付・学年帯付きで表示**し、予約は受け付けない。

## 実装上の対応箇所（参照用）

| 操作 | 主な実装 |
|------|-----------|
| 対象日の空き状況（閲覧） | `GET /api/event-days/{date}/availability`: 上記に加え **中止系**も 200。集計は閲覧可。枠の `bookable` は **`open` かつ締切前**のときのみ true |
| 新規予約 | `create_public_reservation` RPC: `status = open` かつ締切前。`POST /api/reservations` |
| 変更 | `PATCH /api/reservations/[token]`: `ed.status === 'open'` かつ締切前 |
| 取消 | `cancel_public_reservation` RPC: `status = open` かつ締切前。`POST /api/reservations/[token]/cancel` |
| 公開の開催日一覧 | `GET /api/event-days`: **`open` / `locked` / `confirmed` / `cancelled_weather` / `cancelled_minimum`** を返す（一般カレンダーで表示。中止日も掲示）。`acceptingReservations` は **`open` かつ締切が未来**のときだけ true（新規予約は従来どおり open のみ） |
| `locked` への遷移 | 管理 `PATCH /api/admin/event-days/[id]`（`open` → `locked`）。**Cron JOB01:** `GET /api/cron/lock-event-days`（`vercel.json`・`CRON_SECRET` 必須） |
| 開催日枠の管理更新 | **`draft` / `open` かつ active 予約 0 件**のときのみ `PATCH` / `POST` `/api/admin/event-days/[id]/slots`。予約が残る場合の変更は **`/slots/force`**（`acknowledgeReservationRisk: true` 必須）と別確認 UI のみ（正本: `docs/spec/design-mvp.md` §3-2・§3-2-2） |

## Cron（Vercel）

**スケジュールの正本はリポジトリの `vercel.json`。** 式は **UTC**（JST は常に UTC+9）。各エンドポイントは **実行時刻のカレンダー**（主に東京日付）で対象 `event_days` を絞る。

| JOB | パス | `vercel.json`（UTC） | 同日 JST（目安） |
|-----|------|----------------------|------------------|
| 01 締切ロック | `/api/cron/lock-event-days` | `0 6 * * *` | **15:00** |
| 02 午前補完・午後編成 | `/api/cron/run-matching-locked` | `1 6 * * *` | **15:01** |
| 案内 メール | `/api/cron/send-matching-proposal` | `30 7 * * *` | **16:30** |
| 03 前日最終メール | `/api/cron/send-day-before-final` | `0 8 * * *` | **17:00** |

- **認証:** いずれも `CRON_SECRET`（16 文字以上推奨）を Vercel に登録すると、`Authorization: Bearer …` で実行できる。
- **Staging での確認例（JOB01）:** `event_days` の 1 行を `status=open` のまま `reservation_deadline_at` を過去にし、`GET /api/cron/lock-event-days` を手動実行（Bearer 付き）→ `updatedCount` が 1 になり、その行が `locked` または `cancelled_minimum` になること。
- **雨天:** 原則は前日 **17:00** の JOB03 で開催／雨天中止を通知。荒天などは管理画面から **即時雨天メール**（`weather_cancel_immediate`）または **「前日 17:00 に雨天文面を送る」予約**（`weather_day_before_rain_scheduled`・API `delivery: day_before_17`）を利用。詳細は `design-mvp.md` §2-8・§9、`POST /api/admin/event-days/{id}/weather-decision`。

## エラー区分（API）

- **締切超過**: `deadline_passed`（RPC）／HTTP 409 と日本語メッセージ（Route Handler）
- **開催日が open でない**: `event_not_open`（RPC）／HTTP 409

締切と `open` の両方に引っかかる場合は、**実装の評価順**に依存する（取消 RPC は先に `open` を検査し、その後に締切を検査する）。

## 予約作成と代表学年（関連仕様）

- 公開 `POST /api/reservations` は `create_public_reservation` RPC に **`p_representative_grade_year`（1〜6）** を渡す。  
- 開催日の `grade_band` が `1-2` / `3-4` / `5-6` のとき、選択学年がその帯に含まれるか **RPC で検証**する（不整合は `invalid_input` 等）。  
- 画面・設計の詳細は **`design-mvp.md` §2-1・§2-4**、マイグレーション（`teams.representative_grade_year` と RPC 引数）を参照。
