# 管理運用：主要状態の遷移表

**目的:** 許容される状態変化と **正規の更新経路** を固定し、画面増殖時の **不正遷移・二重更新** を防ぐ。  
**前提:** DB の型・制約はマイグレーション正本（`20260407120000_initial_schema.sql` および ENUM 追加系）。締切と予約可否は `reservation-deadline-and-event-status.md`。  
**関連:** [境界仕様](./admin-ops-boundary-spec.md) · [API 責務](./admin-api-projection-command.md)

---

## 1. `event_days.status`（`event_day_status` ENUM）

### 1.1 値の一覧（意味）

| 値 | 意味（運用） |
|----|----------------|
| `draft` | 公開前。一般カレンダーに載せない。 |
| `open` | 公開中。締切前は新規予約・変更・取消可（他条件は RPC 参照）。 |
| `locked` | 締切後のロック。編成バッチの前提。 |
| `confirmed` | 前日確定（編成）適用済み。 |
| `cancelled_weather` | 雨天等による中止（天候判断フロー）。 |
| `cancelled_minimum` | 最少催行不足（Cron JOB01 等）。 |
| `cancelled_operational` | 運営都合中止（雨天判断とは別 API）。 |

### 1.2 代表的な遷移（許可 / 経路）

| From → To | 条件（要約） | 正規経路（実装） |
|-------------|--------------|------------------|
| `draft` → `open` | 公開操作 | 管理 `PATCH /api/admin/event-days/[id]` |
| `open` → `draft` | 公開戻し | 同上 |
| `open` → `locked` | 締切到達後のロック | **Cron** `GET /api/cron/lock-event-days`、緊急時 `POST .../apply-deadline-catchup`（JOB01 同等の locked 側） |
| `open` → `cancelled_minimum` | 締切時 active チーム数 < 3 | **Cron JOB01** または緊急時 `POST .../apply-deadline-catchup` |
| `locked` → `confirmed` | マッチング実行成功 | `POST /api/admin/matching/run` → RPC `admin_apply_matching_run` |
| `confirmed` → `locked` | 午後自動のみ取り消し等 | `POST /api/admin/matching/undo` 等（RPC 種別により可否） |
| `locked` / `confirmed` → `cancelled_weather` | 雨天 cancel | `POST .../weather-decision`（`go` で復帰する経路あり） |
| `*` → `cancelled_operational` | 運営中止 | `POST .../operational-cancel`（詳細は API・マイグレーション） |
| `cancelled_operational` → 復帰 | 運営復帰 | `POST .../operational-restore` |

**注意:** 管理 `PATCH /api/admin/event-days/[id]` が **受理する `status` は `draft` / `open` / `locked` のみ**（公開・手動ロック）。`confirmed` や各種 `cancelled_*` は **専用 API / Cron / RPC** 経由。締切済み `open` の救済（最少催行分岐あり）は **`POST .../apply-deadline-catchup`** を使い、**`PATCH` での単純 `locked` は締切リカバリに使わない**（最少中止を踏まない）。

### 1.3 `event_days.weather_status`（text）

- 天候の **現在の表示用スナップショット**（`go` / `cancel` 等）。詳細な判断履歴は **`weather_decisions`**。

---

## 2. `reservations.status`（`reservation_status`）

| 値 | 意味 |
|----|------|
| `active` | 有効予約 |
| `cancelled` | 取消済み |

| From → To | 正規経路 |
|-----------|----------|
| `active` → `cancelled` | 公開 `POST /api/reservations/[token]/cancel`（締切前・open 時）／管理側の取消があればその API |

---

## 3. `matching_runs`（`matching_run_status` + `is_current`）

| 列 | 意味 |
|----|------|
| `status` | `success` / `failed`（当ジョブの成否） |
| `is_current` | その `event_day_id` で **現在採用の1 run**（partial unique で一意） |

| 操作 | 正規経路 |
|------|----------|
| 新 run 作成・旧 run を非 current | `admin_apply_matching_run`（管理 `POST /api/admin/matching/run`） |
| 取り消し・locked 戻し | `POST /api/admin/matching/undo` 等、専用 RPC |

---

## 4. `notifications.status`（CHECK: pending / sent / failed）

| From → To | 正規経路（例） |
|-----------|----------------|
| `pending` → `sent` / `failed` | メール送信処理・Resend 応答 |
| `failed` → `pending`（再送） | `POST /api/admin/notifications/[id]/retry` |

**原則:** `failed` は **案件化しない**（fact のまま）。人手フォローは別インボックス（将来の Case）で **リンク**する。

---

## 5. 横断参照用メモ

- **予約可否:** `event_days.status === open` かつ **`reservation_deadline_at` と `now()`**（仕様書の評価順あり）。
- **前日確定の「確定したか」の UI 表現:** `event_days.status === confirmed` と **`matching_runs.is_current` + warning** の組み合わせで projection（ハブ上段用）。

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-04-20 | 初版 |
