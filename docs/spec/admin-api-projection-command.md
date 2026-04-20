# 管理 API：`projection` / `command` 責務表

**目的:** 読み取り（projection）と更新（command）を明示し、**同一ライフサイクルを複数ルートから更新しない**ための参照表。新規 API はこの表に **追記してから** 実装する。  
**前提:** 認証は原則 `getAdminUser()`（管理者）。Cron 専用は各ルートの実装コメント参照。  
**関連:** [境界仕様](./admin-ops-boundary-spec.md) · [状態遷移](./admin-state-transitions.md)

**凡例**

| 種別 | 意味 |
|------|------|
| **P** | Projection（副作用なし、主に GET） |
| **C** | Command（DB 更新・副作用あり） |

---

## 1. `src/app/api/admin/**` 一覧（現行スナップショット）

| パス | メソッド | P/C | 主な対象集約 | 備考 |
|------|----------|-----|----------------|------|
| `/api/admin/dashboard/next-event-day` | GET | P | EventDay + 集計 | ダッシュ連鎖用。`loadNextEventDayHubSummaryAfter`（運営まとめと同一 SELECT・集計経路） |
| `/api/admin/event-days` | POST | C | EventDay + Slots | 新規開催日 + 既定枠 |
| `/api/admin/event-days/[id]` | PATCH | C | EventDay | `draft`↔`open`、`open`→`locked` のみ |
| `/api/admin/event-days/[id]/apply-deadline-catchup` | POST | C | EventDay, Notifications | Cron JOB01 同等を 1 件。`acknowledged: true` 必須。締切経過・`open` のみ |
| `/api/admin/event-days/[id]` | DELETE | C | EventDay | `draft` かつ予約ゼロのみ |
| `/api/admin/event-days/[id]/slots` | GET | P | EventDay, Slots | 枠一覧 |
| `/api/admin/event-days/[id]/slots` | PATCH / POST | C | Slots（EventDay 管轄） | 編集可否は status・予約件数でガード |
| `/api/admin/event-days/[id]/slots/force` | POST | C | Slots | 予約ありの強制更新（確認フラグ必須） |
| `/api/admin/event-days/[id]/weather-decision` | POST | C | EventDay, `weather_decisions`, Notifications | 雨天判断・メール |
| `/api/admin/event-days/[id]/operational-cancel` | POST | C | EventDay, Notifications | 運営中止 |
| `/api/admin/event-days/[id]/operational-restore` | POST | C | EventDay | 運営中止からの復帰 |
| `/api/admin/event-days/[id]/notification-summary` | GET | P | Notifications 等 | 開催日単位の通知サマリ |
| `/api/admin/matching/run` | POST | C | MatchingRun, EventDay, … | 編成適用（RPC） |
| `/api/admin/matching/undo` | POST | C | MatchingRun, EventDay | 取り消し系 |
| `/api/admin/matches` | GET | P | MatchingRun, Assignments, Reservations | 前日確定結果参照 |
| `/api/admin/matches/[id]` | PATCH | C | MatchAssignment | 確定補正（手動差し替え） |
| `/api/admin/notifications` | GET | P | Notification | 一覧・フィルタ。`eventDayId` 指定時は `limit`（既定 100・最大 300）で件数上限 |
| `/api/admin/notifications/[id]/retry` | POST | C | Notification | 再送 |
| `/api/admin/reservations/[id]` | PATCH | C | Reservation, Team 一部 | 連絡先・人数・備考等（枠・試合は別導線） |
| `/api/admin/lunch-menu-items` | GET / POST | P / C | LunchMenu（設定寄り） | マスタ |
| `/api/admin/lunch-menu-items/[id]` | PATCH / DELETE | C | LunchMenu | 同上 |
| `/api/admin/camp-inquiries/[id]` | PATCH 等 | C | Inquiry | 問い合わせ状態・対応メモ（実装参照） |
| `/api/admin/tournament-inquiries/[id]` | PATCH 等 | C | Inquiry | 同上 |

**未掲載の admin ルート:** リポジトリ内 `src/app/api/admin/**/*.ts` を正とし、追加・削除時は **本表を更新**する。

---

## 2. ライフサイクル変更と API の対応（太字＝主経路）

| ライフサイクル操作 | Command API（主） |
|--------------------|-------------------|
| 公開 / 非公開 | `PATCH /api/admin/event-days/[id]` |
| 手動締切ロック（一覧常設なし） | 緊急時のみ `POST .../apply-deadline-catchup`（JOB01 同等）または Cron。単純 `PATCH`→`locked` は最少中止を踏まない |
| 自動締切ロック・最少中止 | Cron `lock-event-days` |
| 編成適用（locked → confirmed） | `POST /api/admin/matching/run` |
| 雨天中止 / 復帰 | `POST .../weather-decision` |
| 運営中止 / 復帰 | `POST .../operational-cancel` · `.../operational-restore` |
| 配信再送 | `POST /api/admin/notifications/[id]/retry` |

---

## 3. 運営まとめ（UI）と API の関係

| UI 層 | 呼び出しの望ましさ |
|--------|---------------------|
| 運営まとめ **上段** | **P のみ**（集計はサーバで 1 クエリ or 専用 projection API）。 |
| 運営まとめ **下段のリンク** | 既存の **C を持つ画面**へ遷移。まとめ画面内に PATCH を複製しない。 |
| 運営まとめ **締切の緊急実行** | 専用 **`POST .../apply-deadline-catchup`**（Cron と同一ロジック・確認 UI 付き）。一覧に常設の locked ボタンは置かない方針は維持。 |
| ダッシュ（直近の開催状況） | P のみ。詳細更新は運営まとめまたは専用 command 画面へ。 |

---

## 4. 将来：Case テーブル導入時

| 種別 | 想定 |
|------|------|
| P | `GET /api/admin/cases`（インボックス一覧） |
| C | `POST /api/admin/cases`, `PATCH /api/admin/cases/[id]`（状態・担当・完了） |

既存の `notifications.failed` は **fact として残し**、Case は `notification_id` / `reservation_id` / `event_day_id` を任意参照で **リンク**する。

---

## 5. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-04-20 | 初版 |
