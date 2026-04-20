# 実装準拠 挙動カタログ（テスト設計向け）

**目的:** 画面・API・Cron・DB 制約について、**テストケース ID を振れる粒度**で期待結果を固定する。実装と矛盾する場合は **コード／マイグレーションを正**とし、本書を修正する。

**テスト ID の推奨プレフィックス**

| プレフィックス | 対象 |
|----------------|------|
| `BC-AUTH-*` | 認証・権限 |
| `BC-PUB-*` | 一般公開 API・公開画面 |
| `BC-ADM-UI-*` | 管理画面（ルート・表示・導線） |
| `BC-ADM-API-*` | 管理 API |
| `BC-CRN-*` | Cron |
| `BC-RPC-*` | Supabase RPC・DB 制約 |
| `BC-DATA-*` | 代表データ・締切計算・ポリシー関数 |

---

## 1. 予約締切と `event_days.status`

### 1.1 基本方針

- **予約可否の判定:** `reservation_deadline_at`（`timestamptz`）とサーバの `now()`。締切後は **新規・変更・取消不可**。
- **`locked` への遷移:** DB が締切瞬間に自動で反転するわけではない。`open` のまま締切を過ぎうる。**Cron** または **管理の締切リカバリ API** が `open` を処理する。
- **Cron 対象:** `status = open` かつ `reservation_deadline_at <= now()` の行（実装のクエリを正とする）。
- **運用既定の締切:** 開催日の **2 日前 15:00（Asia/Tokyo）**。算出ロジックは `src/lib/dates/reservation-deadline-default.ts`。

### 1.2 締切時の分岐（JOB01 同等）

| 条件 | 期待する `event_days.status` | 通知の例 |
|------|-------------------------------|----------|
| 締切時点で **active 予約のチーム数 ≥ 3** | `locked` | 最少中止以外のフローへ |
| 締切時点で **active 予約のチーム数 < 3** | `cancelled_minimum` | `minimum_cancel_notice` 等（実装のテンプレ名を正とする） |

**BC-DATA-01:** 開催日新規作成時、`reservation_deadline_at` が上記既定で埋まること。  
**BC-RPC-01:** `create_public_reservation` は `status = open` かつ締切前のみ成功。  
**BC-RPC-02:** 締切後は RPC が拒否（`deadline_passed` 等、実装のエラーコードを正とする）。  
**BC-RPC-03:** `status !== open` のときは締切前でも予約不可（`event_not_open` 等）。

### 1.3 公開 API と締切・status

| 操作 | エンドポイント / RPC | 成功条件（要約） |
|------|----------------------|------------------|
| 空き状況 | `GET /api/event-days/[date]/availability` | 中止系 status も 200。`bookable` は **`open` かつ締切前**のみ true |
| 開催日一覧 | `GET /api/event-days` | `draft` 以外を返す想定（実装の SELECT を正とする）。`acceptingReservations` は **`open` かつ締切が未来**のみ true |
| 新規予約 | `POST /api/reservations` → `create_public_reservation` | `open` かつ締切前 |
| 変更 | `PATCH /api/reservations/[token]` | `open` かつ締切前 |
| 取消 | `POST /api/reservations/[token]/cancel` | `open` かつ締切前 |

**BC-PUB-01〜:** 各組み合わせ（締切前後 × status）で 200 / 409 が仕様どおりであること。

### 1.4 開催日枠の管理更新

| 条件 | 期待 |
|------|------|
| `draft` または `open` かつ **active 予約 0 件** | `PATCH` / `POST` `/api/admin/event-days/[id]/slots` が通常ルートで更新可 |
| 上記以外で枠変更が必要 | `POST .../slots/force` ＋ `acknowledgeReservationRisk: true`（確認 UI 付き） |

**BC-ADM-API-SLOTS-01 / 02:** 上記のガードが 409 等で効くこと。

### 1.5 手動ロックと締切リカバリ

- 管理 `PATCH /api/admin/event-days/[id]` が受理する `status` は **`draft` / `open` / `locked`** に限定（`confirmed` や各種 `cancelled_*` は専用 API / Cron / RPC）。
- **締切を過ぎた `open` の救済**（最少中止の分岐を含む）は **`POST /api/admin/event-days/[id]/apply-deadline-catchup`**（`acknowledged: true` 必須）。単純 `PATCH` で `locked` にし **最少中止を踏まない**ことは避ける。

**BC-ADM-API-CATCHUP-01:** 締切経過・`open` の行のみ処理対象。Cron JOB01 と同一ロジックであること（実装の共有関数を正とする）。

---

## 2. `event_days.status` の意味と遷移

### 2.1 値の一覧（`event_day_status`）

| 値 | 意味 |
|----|------|
| `draft` | 非公開。一般カレンダーに載せない |
| `open` | 公開中。締切前は予約の作成・変更・取消可（他条件は RPC） |
| `locked` | 締切後ロック。編成バッチの前提 |
| `confirmed` | 編成適用済み |
| `cancelled_weather` | 雨天等による中止 |
| `cancelled_minimum` | 最少催行不足 |
| `cancelled_operational` | 運営都合中止 |

### 2.2 代表的な遷移

| From → To | 条件（要約） | 正規経路 |
|-------------|--------------|----------|
| `draft` ↔ `open` | 公開・非公開 | `PATCH /api/admin/event-days/[id]` |
| `open` → `locked` | 締切到達後 | Cron `lock-event-days` または catch-up |
| `open` → `cancelled_minimum` | active チーム数 < 3 | 同上 |
| `locked` → `confirmed` | 編成成功 | `POST /api/admin/matching/run` → `admin_apply_matching_run` |
| `confirmed` → `locked` | 取り消し系 | `POST /api/admin/matching/undo`（RPC 種別により可否） |
| `*` → `cancelled_weather` | 雨天 | `POST .../weather-decision` |
| `*` → `cancelled_operational` | 運営中止 | `POST .../operational-cancel` |
| `cancelled_operational` → 復帰 | | `POST .../operational-restore` |

**BC-ADM-API-STATUS-01:** `PATCH` で `confirmed` や `cancelled_*` に直接は更新できないこと。

### 2.3 天候

- `event_days.weather_status` は表示用スナップショット。履歴は `weather_decisions`。
- 雨天メールの即時／前日 17:00 予約等は `POST .../weather-decision` のペイロードで切替（実装の enum / テンプレを正とする）。

---

## 3. その他の状態

### 3.1 `reservations.status`

| 値 | 意味 |
|----|------|
| `active` | 有効 |
| `cancelled` | 取消済 |

`active` → `cancelled`: 公開 `POST /api/reservations/[token]/cancel` または管理側の取消 API（実装参照）。

### 3.2 `matching_runs`

- `status`: `success` / `failed`
- `is_current`: その開催日で **現在採用の 1 行**（DB の partial unique を正とする）

### 3.3 `notifications.status`

許容値: `pending` / `sent` / `failed`。再送は `POST /api/admin/notifications/[id]/retry` で `failed` → 再処理。

---

## 4. 管理 API 一覧（projection / command）

**凡例:** **P** = 読み取り（副作用なし）、**C** = 更新あり。

| パス | メソッド | P/C | 主な対象 | 備考 |
|------|----------|-----|----------|------|
| `/api/admin/dashboard/next-event-day` | GET | P | EventDay + 集計 | ダッシュ連鎖用 |
| `/api/admin/event-days` | POST | C | EventDay + Slots | 新規開催日 + 既定枠 |
| `/api/admin/event-days/[id]` | PATCH | C | EventDay | `draft`↔`open`、`open`→`locked` のみ |
| `/api/admin/event-days/[id]/apply-deadline-catchup` | POST | C | EventDay, Notifications | `acknowledged: true` 必須 |
| `/api/admin/event-days/[id]` | DELETE | C | EventDay | `draft` かつ予約ゼロのみ |
| `/api/admin/event-days/[id]/slots` | GET | P | Slots | 枠一覧 |
| `/api/admin/event-days/[id]/slots` | PATCH / POST | C | Slots | status・予約件数でガード |
| `/api/admin/event-days/[id]/slots/force` | POST | C | Slots | 強制更新 |
| `/api/admin/event-days/[id]/weather-decision` | POST | C | EventDay, weather_decisions, Notifications | 雨天判断 |
| `/api/admin/event-days/[id]/operational-cancel` | POST | C | EventDay, Notifications | 運営中止 |
| `/api/admin/event-days/[id]/operational-restore` | POST | C | EventDay | 復帰 |
| `/api/admin/event-days/[id]/notification-summary` | GET | P | Notifications 等 | 開催日単位サマリ |
| `/api/admin/matching/run` | POST | C | MatchingRun, … | RPC 適用 |
| `/api/admin/matching/undo` | POST | C | MatchingRun, EventDay | 取り消し |
| `/api/admin/matches` | GET | P | MatchingRun, Assignments | 確定結果参照 |
| `/api/admin/matches/[id]` | PATCH | C | MatchAssignment | 手動補正 |
| `/api/admin/notifications` | GET | P | Notification | フィルタ・`eventDayId` 時は `limit` 上限 |
| `/api/admin/notifications/[id]/retry` | POST | C | Notification | 再送 |
| `/api/admin/reservations/[id]` | PATCH | C | Reservation, Team 一部 | 連絡先・人数等 |
| `/api/admin/lunch-menu-items` | GET / POST | P / C | LunchMenu | マスタ |
| `/api/admin/lunch-menu-items/[id]` | PATCH / DELETE | C | LunchMenu | |
| `/api/admin/camp-inquiries/[id]` | PATCH 等 | C | Inquiry | 状態・メモ |
| `/api/admin/tournament-inquiries/[id]` | PATCH 等 | C | Inquiry | 同上 |

**未掲載ルート:** `src/app/api/admin/**/*.ts` を正本とし、追加時は **本表に追記**する。

### 4.1 ライフサイクルと主経路

| 操作 | Command API |
|------|-------------|
| 公開 / 非公開 | `PATCH /api/admin/event-days/[id]` |
| 締切ロック・最少中止 | Cron `lock-event-days` または `POST .../apply-deadline-catchup` |
| 編成適用 | `POST /api/admin/matching/run` |
| 雨天 / 復帰 | `POST .../weather-decision` |
| 運営中止 / 復帰 | `POST .../operational-cancel` · `operational-restore` |
| 通知再送 | `POST /api/admin/notifications/[id]/retry` |

---

## 5. 一般公開 API（一覧）

| パス | メソッド | 用途（要約） |
|------|----------|----------------|
| `/api/event-days` | GET | 開催日一覧 |
| `/api/event-days/[date]/availability` | GET | 指定日の空き・bookable |
| `/api/reservations` | POST | 新規予約 |
| `/api/reservations/[token]` | GET / PATCH | 参照・変更 |
| `/api/reservations/[token]/cancel` | POST | 取消 |
| `/api/camp-inquiries` | POST | 問い合わせ |
| `/api/tournament-inquiries` | POST | 問い合わせ |
| `/api/lunch-menu` | GET | 公開昼食メニュー |

**BC-CRN-*** は各 Cron の `route.ts` の認証（`CRON_SECRET`）・対象日付の絞り込み・副作用（通知行の INSERT）をテストする。

---

## 6. Cron（期待サマリ）

| ID | パス | 役割（要約） |
|----|------|----------------|
| BC-CRN-01 | `/api/cron/lock-event-days` | 締切到達 `open` → `locked` or `cancelled_minimum` + 通知 |
| BC-CRN-02 | `/api/cron/run-matching-locked` | 対象日の `locked` に対し編成実行（実装の対象抽出を正とする） |
| BC-CRN-03 | `/api/cron/send-matching-proposal` | 案内メール |
| BC-CRN-04 | `/api/cron/send-day-before-final` | 前日最終 |

スケジュールは **`vercel.json`** のみ正。手動検証手順は `docs/ops/mvp-day-before-runbook.md`。

---

## 7. 管理コンソール画面（ルート）

`src/app/admin/(protected)/` 配下の **実装済み `page.tsx`** を正とする（追加時は本表を更新）。

| パス（例） | 用途（要約） |
|------------|----------------|
| `/admin/dashboard` | 直近開催のハブ |
| `/admin/event-days` | 開催日一覧 |
| `/admin/event-days/[id]` | 運営まとめ（サマリ・警告・導線） |
| `/admin/event-days/[id]/slots` | 枠編集 |
| `/admin/event-days/[id]/slots/force` | 強制枠変更 |
| `/admin/event-days/[id]/weather` | 雨天判断 |
| `/admin/event-days/[id]/operational-cancel` | 運営中止 |
| `/admin/event-days/[id]/notifications` | 通知一覧 |
| `/admin/pre-day-adjust` | 前日調整 |
| `/admin/pre-day-results` | 前日結果 |
| `/admin/reservations` | 予約一覧 |
| `/admin/reservations/[id]` | 予約詳細 |
| `/admin/notifications/failed` | 失敗通知・再送 |
| `/admin/lunch-menu` | 昼食マスタ |
| `/admin/camp-inquiries` | 合宿問い合わせ |
| `/admin/camp-inquiries/[id]` | 詳細 |
| `/admin/tournament-inquiries` | 大会問い合わせ |
| `/admin/tournament-inquiries/[id]` | 詳細 |
| `/admin/event-day-slots` | 枠の横断ビュー（名称は実装に従う） |

**BC-ADM-UI-*** では、上記各画面が **読み取り専用サマリと command 画面の責務分離**（運営まとめ上段は P のみ、更新は下位画面）を満たすこと。

---

## 8. 自動編成

- エントリ: `POST /api/admin/matching/run`、RPC `admin_apply_matching_run`。
- **アルゴリズムの詳細・係数・分岐**は [implemented-matching-algorithm.md](./implemented-matching-algorithm.md) を正とする。
- **BC-MATCH-01:** `event_days.status !== locked` のとき 409 等で拒否されること（実装を正とする）。
- **BC-MATCH-02:** 午後まで確定済みの日に対する再実行の制約（実装の 409 条件を正とする）。

---

## 9. 代表学年（予約時）

- `teams.representative_grade_year`（1〜6）を公開フォームから送る。
- 開催日の `grade_band`（`1-2` / `3-4` / `5-6`）と整合しない場合は RPC が拒否。

**BC-RPC-GRADE-01:** 帯外の学年で `create_public_reservation` が失敗すること。

---

## 10. 改訂時の注意

- 新規 API・画面・Cron を追加したら **本書に BC-* 観点で追記**する。
- エラーコード・HTTP ステータスは **Route Handler / RPC の返却値**が正。本書の日本語説明は補助。
