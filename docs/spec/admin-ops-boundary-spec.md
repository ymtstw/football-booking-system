# 管理運用：集約境界と画面責務（境界仕様）

**目的:** UI 再編（運営まとめ・ナビ4区分など）と並行して、**ドメインの集約境界**と**画面の責務**を固定し、`event_day` への UI 集約と **ドメイン一枚岩化** を混同しない。  
**関連:** [状態遷移](./admin-state-transitions.md) · [API の projection / command](./admin-api-projection-command.md)

---

## 1. 用語の正規定義

| 用語 | 意味 |
|------|------|
| **運営オペレーションの主座標** | 管理者が「この日どうなってる？」に答えるときの軸。UI・ダッシュの主導線はここへ収束してよい。 |
| **`event_day`（開催日）** | 上記の主座標に対応する **DB の1行**（`event_days`）。**運営オペレーションの主集約**だが、**システム全体の唯一の根**ではない。 |
| **Projection（読み取り）** | 複数テーブルを JOIN・集計した **表示用の読み取り**。正規の状態を「再定義」しない。 |
| **Command（更新）** | 不変条件を検証したうえで **正規の状態源を更新**する操作。 |
| **配信失敗（fact）** | `notifications.status = failed` として残る **配信結果の事実**。人手対応の要否とは別層。 |
| **フォロー案件（案）** | 事実上の「人手で追うべきもの」を束ねる **対応案件インボックス**。現行 DB には単一の `cases` テーブルは無く、`camp_inquiries` / `tournament_inquiries` 等が **その役割の一部**を担う。**将来** `case_type`（例: inquiry / reservation_followup / escalation）で拡張可能な形を想定する。 |

---

## 2. 主集約（ドメイン境界）

| 集約 | 主なテーブル / 行 | 責務（要約） |
|------|-------------------|--------------|
| **EventDay** | `event_days`, `event_day_slots` | 開催可否・公開・締切・天候判断・運営中止・枠。予約受付可否は **締切時刻 + status** で判定（詳細は `reservation-deadline-and-event-status.md`）。 |
| **Reservation** | `reservations`, 関連 lunch 等 | チーム単位の参加コミット。取消・人数・連絡先など **予約のライフサイクル**。 |
| **MatchingRun** | `matching_runs`, `match_assignments` | 締切後の編成・前日確定。**`is_current = true` は event_day あたり高々1**（partial unique）。 |
| **Notification** | `notifications` | メール等の **配信キューと結果**（pending / sent / failed）。 |
| **Inquiry（問い合わせ系）** | `camp_inquiries`, `tournament_inquiries`, … | **開催日に閉じない**相談・返信待ち。**人手追跡インボックス**の現行の置き場。 |
| **監査・履歴** | `weather_decisions`, `reservation_events`, `slot_change_logs`, `match_adjustment_logs` 等 | **現在値（列）**とは別に、重要な変更の **事実ログ**。 |

**禁止する混同:** 「画面を `event_day` に寄せる」＝「すべてのエンティティを `event_day` の子にモデル化する」ではない。複数日案件・未定日問い合わせは **Inquiry / 将来の Case** 側に残す。

---

## 3. 画面レイヤの責務（目標アーキテクチャ）

### 3.1 グローバルナビ（4区分）

| 区分 | 役割 |
|------|------|
| **開催運営** | ダッシュ（直近の開催状況）・開催日一覧・**運営まとめ** `/admin/event-days/[id]`（画面では「この開催のまとめ」）への到達。 |
| **予約管理** | 横断の予約検索・救済・例外対応（開催日クエリで文脈引き継ぎ可）。 |
| **対応案件** | **人手で追跡・判断・返信が必要**なもの（問い合わせ種別＋将来の予約フォロー等）。問い合わせ専用に狭めない。 |
| **設定** | マスタ（昼食メニュー等）・環境に長く効くもの。開催日当日の判断とは切り離す。 |

### 3.2 運営まとめ `/admin/event-days/[id]`（中核 UI・画面名「この開催のまとめ」）

| 層 | 置くもの | 置かないもの |
|----|-----------|----------------|
| **上段** | 識別子・公開状態要約・KPI サマリ・警告（失敗通知件数・未確定等）・次アクション（最大少数） | マスタ編集、長大な全件表の本丸 |
| **下段** | 詳細導線（枠・雨天・通知サマリ・運営中止等へのリンク）、軽量な抜粋一覧 | ライフサイクル変更の **重複実装**（ボタンは正規 command API へ） |

**実装メモ（拡張・指標の一貫性）:** 開催日サマリの読み取りは `src/lib/admin/event-day-hub-payload.ts` の `loadEventDayHubPayload` に集約する。ダッシュボード初期表示・「次の開催日」API（`loadNextEventDayHubSummaryAfter`）も同経路で `summary` を取得し、**`event_days` の SELECT 列と運営まとめ画面を常に一致**させる。

### 3.3 ダッシュボード `/admin/dashboard`

- **持つ:** 「次に見るべき開催」の **順番付き一覧**（当日・近日・アラートが気になる日などを先に並べる想定。実装は近い日順のサマリ表示から始める）。
- **持たない:** 運営まとめと二重になる **その日の詳細の正**。詳細は **必ず「この開催のまとめ」へ1クリック**で委譲する。

### 3.4 横断一覧（予約一覧・メール失敗一覧など）

- **役割:** 検索・例外・救済。フィルタで `event_day` 文脈を引き継ぐ。
- **原則:** 運営まとめの「現在値」と矛盾しないよう、**同じ projection 系の読み取り**に寄せる。

---

## 4. 通知失敗と「対応案件」の二層

| 層 | 内容 | 運用上の位置づけ |
|----|------|-------------------|
| **Fact** | `notifications` の `failed` 行 | 再送 UI・ログ調査の対象。**配信の真実**。 |
| **Follow-up（案）** | 人手フォローが必要になったときの **案件化**（将来は `operator_cases` 等で `notification_id` を参照してもよい） | 「届いていないと電話が来た」等の **対応案件**。**failed 行の数だけ必ず案件ができるわけではない**。 |

現行実装では **案件用の独立テーブルは未整備**のため、本ドキュメントは **追加マイグレーション前の設計契約**として扱う。

---

## 5. 現在値と履歴

| 種別 | 正規の「現在」 | 履歴・監査 |
|------|----------------|------------|
| 開催・天候 | `event_days.status`, `weather_status` 等 | `weather_decisions`、必要に応じて中止系スナップショット列 |
| 予約 | `reservations.status` | `reservation_events` |
| 枠 | `event_day_slots` の各列 | `slot_change_logs` |
| 編成 | `matching_runs` / `match_assignments` | `match_adjustment_logs`、run の世代 |

**方針:** 列＝現在値、重要操作＝履歴テーブル。**イベントソーシングまでは必須としない。**

---

## 6. ライフサイクル変更の「正規経路」（太字ルール）

次の変更は **複数のバラ PATCH から行わない**。実装の追加・変更時は [API 責務表](./admin-api-projection-command.md) で **唯一の command 経路**を確認する。

- **公開 / 公開戻し:** `PATCH /api/admin/event-days/[id]`（許可された遷移のみ）
- **締切後の `open` → `locked` / `cancelled_minimum`:** Cron `lock-event-days`（主）。緊急時のみ `POST .../apply-deadline-catchup`（JOB01 同等）。`PATCH` の単純 `locked` は最少中止を踏まないため **締切リカバリ用途に使わない**
- **前日確定（編成適用）:** `POST /api/admin/matching/run`（内部 RPC）／取り消し系 `POST /api/admin/matching/undo` 等
- **雨天判断:** `POST /api/admin/event-days/[id]/weather-decision`（`weather_decisions` 併記）
- **運営中止 / 復帰:** `POST .../operational-cancel` · `POST .../operational-restore`

---

## 7. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-04-20 | 初版（着工前境界仕様として追加） |
