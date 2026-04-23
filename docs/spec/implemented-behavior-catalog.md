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
| 上記以外で枠変更が必要 | `PATCH` / `POST` `/api/admin/event-days/[id]/slots/force` ＋ `acknowledgeReservationRisk: true`（確認 UI 付き） |

**BC-ADM-API-SLOTS-01 / 02:** 上記のガードが 409 等で効くこと。

#### 1.4.1 枠の強制 `PATCH` と朝枠変更の利用者通知

- **対象:** `PATCH /api/admin/event-days/[id]/slots/force` が枠更新に**成功したあと**（`draft` / `open` のみ。実装は `src/app/api/admin/event-days/[id]/slots/force/route.ts`）。**`POST`（枠の強制追加）では本通知は発火しない**（MVP）。
- **誰に送るか:** リクエストで更新された枠 ID のうち **`event_day_slots.phase = morning`** のものに、`reservations.status = active` かつ **`selected_morning_slot_id` がその枠 ID** の予約（1 予約につき朝枠は 1 本のため、**同一 PATCH で複数朝枠が変わっても、同一予約に対する通知行は高々 1 件**。実装では同一バッチ内の `reservation_id` 重複 INSERT を `Set` で抑止）。
- **キュー:** 上記ごとに `notifications` へ **`channel = email`・`status = pending`・`template_key = morning_slot_force_changed`** で INSERT（**HTTP 応答の直前までに完了**し、一覧・サマリで pending が見える）。
- **送信タイミング:** メール送信（Resend）は **`after()`** で**レスポンス返却後**に実行。失敗時は当該行が `failed` となり、**`POST /api/admin/notifications/[id]/retry`** で再送（`notification-retry.ts` にテンプレ分岐あり）。
- **`payload_summary`（再送・監査用）:** 枠コード・変更後の朝の開始/終了時刻に加え、送信時点の **`event_date_iso`・`team_name`・`grade_band`** を JSON で保持。再送時はペイロードを優先し、欠ける旧行は `event_days` / `teams` から補完（実装は `morning-slot-force-changed-mail.ts` のパーサと `notification-retry.ts`）。
- **管理 UI:** 開催日の通知サマリ（`GET .../notification-summary`）に **「朝枠・時刻の変更案内」件数**を含む。送信失敗一覧の **再送ボタンは、再送 API が 200 のあと同一通知 ID について約 5 分間は `sessionStorage` で抑止**（連打防止。`notification-failed-retry-table.tsx`）。

**BC-ADM-API-SLOTS-FORCE-01:** 強制 `PATCH` で朝枠のみ変更したとき、該当予約に `morning_slot_force_changed` の `pending` または `sent`/`failed` が生じること（環境変数未設定時は `pending` のまま等、実装ログを正とする）。

### 1.5 手動ロックと締切リカバリ

- 管理 `PATCH /api/admin/event-days/[id]` が受理する `status` は **`draft` / `open` / `locked`** に限定（`confirmed` や各種 `cancelled_*` は専用 API / Cron / RPC）。
- **締切を過ぎた `open` の救済**（最少中止の分岐を含む）は **`POST /api/admin/event-days/[id]/apply-deadline-catchup`**（`acknowledged: true` 必須）。単純 `PATCH` で `locked` にし **最少中止を踏まない**ことは避ける。

**BC-ADM-API-CATCHUP-01:** 締切経過・`open` の行のみ処理対象。Cron JOB01 と同一ロジックであること（実装の共有関数を正とする）。

### 1.6 締切 Cron（JOB01）内の自動編成と `locked`（将来変更・運用メモ）

- **現行の正:** `GET /api/cron/lock-event-days`（`src/app/api/cron/lock-event-days/route.ts` → `processReservationDeadlinePassed` のあと、返却された `lockedIds` ごとに `applyMatchingForEventDayId`）は、締切処理の対象が **`status = open` かつ `reservation_deadline_at <= now()`** の開催日のみ。各対象について **`open` → `locked`** に更新した**同一 HTTP リクエスト内**で自動編成を実行し、**成功し得る場合は `confirmed` まで遷移**する。
- **`locked` の意味（状態として残す理由）:** **締切後・新規予約等は受け付けない段階**であり、かつ **午後一括編成（`admin_apply_matching_run`）の前提**である。現行の成功系では **`locked` が長く観測されず `confirmed` に進みやすい**が、編成が完了しない場合は **`locked` に滞留**する。将来「締切と編成のあいだに猶予を挟む」運用に戻す場合も、**この語と遷移を維持したまま** Cron の分割や遅延で表現できる（**新しい `status` 値を増やさなくてもよい**ことが多い）。
- **再試行・リカバリ:** 翌日以降の締切 Cron は **`open` の行しか列挙しない**（`processReservationDeadlinePassed` のクエリが正本）。したがって **すでに `locked` のままの開催日は、締切 Cron だけでは自動では再ロック・再編成されない**。再編成は **`GET /api/cron/run-matching-locked`**（`status = locked` を列挙。**Vercel 定期からは外している** → 本番で必要なら手動実行または `vercel.json` に定期を追加する運用判断）または **管理の編成実行**（`POST /api/admin/matching/run` 等、実装を正とする）を想定する。
- **歴史的経緯:** かつては締切で `locked` にした**あと時間をあけて**別バッチで自動編成する構成があり、そのとき **`locked` は「予約停止〜編成前」として画面上・運用上長く残る**前提だった。**現状は一体型**（締切 Cron 内で編成まで）に変更済み。

---

## 2. `event_days.status` の意味と遷移

### 2.1 値の一覧（`event_day_status`）

| 値 | 意味 |
|----|------|
| `draft` | 非公開。一般カレンダーに載せない |
| `open` | 公開中。締切前は予約の作成・変更・取消可（他条件は RPC） |
| `locked` | 締切後ロック（新規予約等は不可）。午後一括編成の前提。**現行では締切 Cron 内で編成まで試みるため、成功系では一瞬または観測されず `confirmed` へ進みやすい。** 編成未完了時は滞留（§1.6）。 |
| `confirmed` | 編成適用済み（締切 Cron 内の自動編成が成功した場合、同一リクエストで到達し得る） |
| `cancelled_weather` | 雨天等による中止 |
| `cancelled_minimum` | 最少催行不足 |
| `cancelled_operational` | 運営都合中止 |

### 2.2 代表的な遷移

| From → To | 条件（要約） | 正規経路 |
|-------------|--------------|----------|
| `draft` ↔ `open` | 公開・非公開 | `PATCH /api/admin/event-days/[id]` |
| `open` → `locked` | 締切到達後（最少催行以外） | Cron `lock-event-days` のロック段階、または catch-up。続けて同一リクエスト内で編成が走り得る（§1.6） |
| `open` → `cancelled_minimum` | active チーム数 < 3 | 同上 |
| `locked` → `confirmed` | 編成成功 | **主経路:** 締切 Cron 内の `applyMatchingForEventDayId`。**手動・再実行:** `POST /api/admin/matching/run` → `admin_apply_matching_run`、または `GET /api/cron/run-matching-locked` |
| `confirmed` → `locked` | 取り消し系 | `POST /api/admin/matching/undo`（RPC 種別により可否） |
| `*` → `cancelled_weather` | 雨天 | `POST .../weather-decision` |
| `*` → `cancelled_operational` | 運営中止 | `POST .../operational-cancel` |
| `cancelled_operational` → 復帰 | | `POST .../operational-restore` |

**BC-ADM-API-STATUS-01:** `PATCH` で `confirmed` や `cancelled_*` に直接は更新できないこと。

### 2.3 天候

- `event_days.weather_status` は表示用スナップショット。履歴は `weather_decisions`。
- 雨天メールの即時／前日一括（`day_before_17`）予約等は `POST .../weather-decision` のペイロードで切替（実装の enum / テンプレを正とする）。

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

許容値: `pending` / `sent` / `failed`。再送は `POST /api/admin/notifications/[id]/retry` で `failed` → 再処理。`template_key` ごとに再送ロジックが実装されており、**枠強制変更後の朝枠案内**は `morning_slot_force_changed`（§1.4.1）。

---

## 4. 管理 API 一覧（projection / command）

**凡例:** **P** = 読み取り（副作用なし）、**C** = 更新あり。

| パス | メソッド | P/C | 主な対象 | 備考 |
|------|----------|-----|----------|------|
| `/api/admin/dashboard/next-event-day` | GET | P | EventDay + 集計 | ダッシュ連鎖用 |
| `/api/admin/event-days` | POST | C | EventDay + Slots | 新規開催日 + 既定枠 |
| `/api/admin/event-days/[id]` | PATCH | C | EventDay | `draft`↔`open`、`open`→`locked` のみ。`draft`→`open` は有効昼食1件以上（`assertEventDayAcceptsBookableLunchMenus`＝グローバル or その日専用の実効集合） |
| `/api/admin/event-days/[id]/apply-deadline-catchup` | POST | C | EventDay, Notifications | `acknowledged: true` 必須 |
| `/api/admin/event-days/[id]` | DELETE | C | EventDay | `draft` かつ予約ゼロのみ |
| `/api/admin/event-days/[id]/slots` | GET | P | Slots | 枠一覧 |
| `/api/admin/event-days/[id]/slots` | PATCH / POST | C | Slots | status・予約件数でガード |
| `/api/admin/event-days/[id]/slots/force` | PATCH / POST | C | Slots, Notifications | 強制枠更新（PATCH）／枠追加（POST）。PATCH 成功時は朝枠変更通知のキュー・送信（§1.4.1） |
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
| `/api/admin/lunch-menu-items` | GET / POST | P / C | LunchMenu | マスタ。POST はグローバル有効が0件のとき非公開のみは拒否 |
| `/api/admin/lunch-menu-items/[id]` | PATCH / DELETE | C | LunchMenu | 有効メニューは常に1件以上。PATCH `is_active:false` 時は任意 `co_activate_menu_item_id` で先に別メニューを公開可。DELETE は `?promote_active_first=` で同様 |
| `/api/admin/event-days/[id]/lunch-menu` | GET / PUT | P / C | `event_day_lunch_menu_items`, LunchMenu | 開催日別昼食（既定グローバル or 専用サブセット） |
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
| 枠強制変更（朝）と利用者への枠・時刻案内 | `PATCH /api/admin/event-days/[id]/slots/force`（§1.4.1） |

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
| `/api/lunch-menu` | GET | 公開昼食。`?eventDayId=` でその開催日の有効セット（専用行があればサブセット、なければグローバル有効のみ） |

### 5.1 昼食メニュー（DB と解決ルール）

- **グローバル:** `lunch_menu_items`。`is_active` が予約で選べるマスタ行。管理 API で **有効行は常に1件以上**（最後の1件を非公開／削除で0件にしない。別メニューを同時に公開するパラメータあり）。
- **開催日上書き:** `event_day_lunch_menu_items`（`event_day_id` + `lunch_menu_item_id`）。**その開催日に0件**なら、予約・公開 API はグローバルの有効行のみを使う。**1件以上**なら、その ID に含まれるうち `is_active` な行だけがその日の予約で有効。`create_public_reservation` も同じ集合で検証する。
- **予約受付開始（`open`）時の昼食ゲート:** `draft`→`open` の `PATCH /api/admin/event-days/[id]`、および `POST /api/admin/event-days` で **作成直後から `open`** の場合、運営中止復帰で **`open` に戻す**場合、雨天中止から **`open` に戻す**場合は、上記と同じ実効昼食集合（`fetchEffectiveLunchMenuItemsForEventDay`）が **1件以上**であることを必須とする（0件なら 422）。グローバル運用ならグローバル有効、専用運用なら専用×有効の交差が1件以上になるまで公開不可。
- **既存予約とメニュー変更（MVP 以降の整理用メモ）:** 予約時点の昼食は `reservation_lunch_items` 等に保存され、**変更・新規予約の検証は「その時点の実効メニュー集合」**に対して行う。開催日・マスタの変更後も、過去に選んだメニューIDが非公開・専用から外れた場合の扱い（表示・変更可否・運用補正）は MVP では運用回避前提。**スナップショットをどこまで保証するか**は別途仕様化する。

**BC-CRN-*** は各 Cron の `route.ts` の認証（`CRON_SECRET`）・対象日付の絞り込み・副作用（通知行の INSERT）をテストする。

---

## 6. Cron（期待サマリ）

| ID | パス | 役割（要約） |
|----|------|----------------|
| BC-CRN-01 | `/api/cron/lock-event-days` | 締切到達 `open` → `locked` or `cancelled_minimum` + 通知。**`locked` になった行は同一リクエスト内で自動編成を試み、`confirmed` まで進み得る**（§1.6） |
| BC-CRN-02 | `/api/cron/run-matching-locked` | 対象日の `locked` に対し編成実行（**Vercel 定期からは外し**手動・ローカル用。本番の主経路は JOB01 内の自動編成） |
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
| `/admin/event-days/[id]/lunch` | 開催日別昼食（グローバル既定 or この日専用） |
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
