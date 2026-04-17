# 管理者画面：現行仕様（コードベース）

**目的:** 機能見直しのたたき台として、実装されている管理 UI・API の範囲を整理する。  
**前提:** Next.js App Router（`src/app/admin`）、Supabase Auth。管理者は **`app_admins` に登録されたユーザーのみ**（`getAdminUser()`）。

**最終更新:** 実装に基づくスナップショット（リポジトリ内コード）。

---

## 1. 認証・ルーティング

| 項目 | 仕様 |
|------|------|
| 判定 | ログイン済み **かつ** `app_admins.user_id` が一致する場合のみ管理者 |
| 保護レイアウト | `src/app/admin/(protected)/layout.tsx` … 未管理者は `/admin/login` へ `redirect` |
| `/admin` | 管理者なら **`/admin/event-days` へリダイレクト**（ダッシュボードではない） |
| ログイン | `/admin/login`（公開レイアウト） |
| ログアウト | ヘッダのサインアウト（保護レイアウト内） |

**管理 API:** `src/app/api/admin/**` の各ルートで原則 `getAdminUser()` による 401。一部は Cron 用シークレット併用（例: マッチング実行は別途コード参照）。

---

## 2. グローバルナビ（保護レイアウト）

表示リンク（左から）:

1. **ダッシュボード** → `/admin/dashboard`
2. **開催日** → `/admin/event-days`
3. **予約一覧** → `/admin/reservations`
4. **前日確定** → `/admin/pre-day-results`
5. **メール失敗** → `/admin/notifications/failed`
6. **合宿相談** → `/admin/camp-inquiries`

右側: ログインメール表示 + サインアウト。

---

## 3. ダッシュボード（`/admin/dashboard`）

- **役割:** 東京日付の「今日」以降で **最も早い `event_days` 1 件**のサマリー（来場チーム数・昼食・参加人数・状態・通知 failed 等）を表示。
- **連鎖表示:** クライアントで **「次の開催日を読み込む」** → `GET /api/admin/dashboard/next-event-day` で続く開催を同形式で積み上げ（数日分の把握用）。
- **導線:** 前日確定・開催日管理へのリンク等（画面内文言参照）。

---

## 4. 開催日管理（`/admin/event-days`）

### 4.1 一覧・カレンダー

- **開催カレンダー:** 全件に近い一覧から日付を選ぶと **`?around=YYYY-MM-DD`** で「基準開催日」が変わる。
- **一覧テーブル（md 以上）:** 基準日より前（最大 N 件）＋基準日以降（最大 M 件）。件数定数は `src/lib/admin/event-day-list-limits.ts`。
- **モバイル:** 1 行＝カード（`EventDayMobileCard`）。
- **表示列:** 開催日・学年帯・状態・締切（東京表示）・枠/天候/緊急中止リンク・操作（公開系）。

### 4.2 新規作成（公開前）

- **フォーム:** `CreateEventDayForm` … 開催日・学年帯（`1-2` / `3-4` / `5-6`）・締切（`datetime-local`、既定は開催日から算出）。
- **API:** `POST /api/admin/event-days` … **`draft` で作成** + 既定枠（`default-slots`）を `event_day_slots` に自動生成。

### 4.3 行操作（`draft` / `open` のみ）

- **公開:** `PATCH /api/admin/event-days/[id]` … `status: open`（一般向け `GET /api/event-days` に載る）。
- **公開前に戻す:** `status: draft`。
- **削除:** `DELETE` … **公開前（draft）かつ予約なし等の条件は API 側**（確認ダイアログ後に実行）。
- **`locked` 以降:** 一覧では操作列は「—」（手動で締切ロックするボタンは **出さない** 方針。コメント上 Cron 想定）。

### 4.4 行からのサブ画面リンク

| リンク | URL |
|--------|-----|
| 枠・時刻 | `/admin/event-days/{id}/slots` |
| 雨天判断 | `/admin/event-days/{id}/weather` |
| 緊急中止（運営） | `/admin/event-days/{id}/operational-cancel` |

（通知サマリーは開催日詳細からではなく、**通知用の専用パス**あり → 下記 §8。）

---

## 5. 枠・時刻（`/admin/event-days/{id}/slots`）

- **通常編集:** 午前/午後枠の時刻・有効・追加など。**`draft` / `open` かつ active 予約 0 件**のときのみ通常 PATCH/POST（409 で拒否される想定）。
- **強制変更:** `/admin/event-days/{id}/slots/force` … 予約残存時。`acknowledgeReservationRisk: true` 必須の別 UI。
- **API:** `GET/PATCH/POST /api/admin/event-days/{id}/slots`、強制は `.../slots/force`。

---

## 6. 雨天判断（`/admin/event-days/{id}/weather`）

- 開催日単位で **go / cancel（天候中止）** 等の判断を保存。
- **API:** `POST /api/admin/event-days/{id}/weather-decision`（詳細はフォーム・API 実装参照）。

---

## 7. 緊急中止・運営都合（`/admin/event-days/{id}/operational-cancel`）

- 運営都合の中止フロー（画面 + 確認）。
- **API:** `POST /api/admin/event-days/{id}/operational-cancel`、復帰は `POST .../operational-restore` 等（実装ファイル参照）。

---

## 8. 通知サマリー（`/admin/event-days/{id}/notifications`）

- 開催日に紐づく **通知送信状況の集計・サマリー**（クライアントで `GET /api/admin/event-days/{id}/notification-summary` を利用）。

---

## 9. 前日確定（`/admin/pre-day-results`）

### 9.1 クエリ

- `?date=YYYY-MM-DD` … 省略時は **東京の今日以降で最も近い開催日**（なければ今日フォールバック）。
- `?tab=matches | adjust` … **補正 UI は `adjust` に統合**。
- `?notifications=failed` … 失敗通知にフォーカスした初期表示。

### 9.2 タブ「試合一覧」（`matches`）

- **`GET /api/admin/matches?date=...`** … 当該日の `event_day`、**現在の matching run**、assignments、**枠ごとの統合ビュー**（午前・午後を 1 表）。
- **マッチング実行:** `POST /api/admin/matching/run`（body に `eventDayId` 等。管理者セッションまたは Cron シークレットの扱いは API 参照）。
- **アンドゥ:** `POST /api/admin/matching/undo`（直近 run の取り消し系。条件は API 参照）。
- 表示: 編成メタ（未充足 ID 等）、警告列、スロット占有者の注記など。

### 9.3 タブ「補正」（`adjust`）

- 午後割当の **手動差し替え**（`PATCH /api/admin/matches/{id}`）… 予約単位のチーム差し替え・**午後枠の移動のみ**等（監査ログ付きの旨は実装コメント参照）。

### 9.4 旧 URL

- `/admin/pre-day-adjust` → **`/admin/pre-day-results?tab=adjust` へリダイレクト**。

---

## 10. メール送信失敗（`/admin/notifications/failed`）

- `notifications.status = failed` の直近分を表形式で表示。
- **再送:** `POST /api/admin/notifications/{id}/retry`（コンポーネント `NotificationFailedRetryTable`）。
- **制約（画面文言）:** 予約完了メールのみ、確認コードの都合で **再送不可** など。

---

## 11. 予約一覧（`/admin/reservations`）

- **デフォルト開催日:** 東京今日以降で最も近い `event_date`（`?date=` で上書き）。
- **絞り込み:** `team`・`email` クエリ（部分一致・小文字化は実装参照）。
- **表示:** 開催日・枠・チーム名・学年・強さ・連絡先・状態など（一覧用 select はページ実装参照）。
- **詳細:** `/admin/reservations/{id}` … 予約内容表示 + **`reservation-detail-edit-client`** で編集可能項目（連絡先・強さ・学年・人数等、API `PATCH /api/admin/reservations/{id}`）。

---

## 12. 合宿相談（`/admin/camp-inquiries`）

- **一覧:** ステータスタブ（新規/対応中/対応済み等）、受付日時・代表者・チーム名・希望日程など。
- **詳細:** `/admin/camp-inquiries/{id}` … フォーム回答の `dl` 表示（値がない非公開項目は非表示ロジックあり）。
- **運用:** ステータス更新（`PATCH /api/admin/camp-inquiries/{id}` … `status: new | in_progress | done`）、メール・電話のコピー、mailto リンク。
- **注意:** 本画面からの **メール送信は行わない**（返信は通常メール想定の文言）。

---

## 13. プレースホルダ・その他

| パス | 内容 |
|------|------|
| `/admin/event-day-slots` | **ダミー UI のみ**。実際の枠編集は **開催日行の「枠・時刻」** から遷移。 |

---

## 14. 主要管理 API 一覧（抜粋）

| メソッド | パス | 用途の概要 |
|----------|------|------------|
| POST | `/api/admin/event-days` | 開催日作成 + 既定枠 |
| PATCH/DELETE | `/api/admin/event-days/[id]` | 状態更新・draft 削除 |
| GET/PATCH/POST | `/api/admin/event-days/[id]/slots` | 枠参照・更新・追加 |
| PATCH/POST | `/api/admin/event-days/[id]/slots/force` | 予約あり強制更新 |
| POST | `/api/admin/event-days/[id]/weather-decision` | 雨天判断 |
| POST | `/api/admin/event-days/[id]/operational-cancel` | 運営中止 |
| POST | `/api/admin/event-days/[id]/operational-restore` | 復帰 |
| GET | `/api/admin/event-days/[id]/notification-summary` | 通知サマリー |
| POST | `/api/admin/matching/run` | マッチング実行 |
| POST | `/api/admin/matching/undo` | マッチングアンドゥ |
| GET | `/api/admin/matches?date=...` | 指定日の編成・枠ビュー |
| PATCH | `/api/admin/matches/[id]` | 試合割当の手動補正 |
| GET | `/api/admin/dashboard/next-event-day` | ダッシュボード用次開催 |
| GET/POST | `/api/admin/notifications` / `.../retry` | 失敗通知・再送 |
| PATCH | `/api/admin/reservations/[id]` | 予約・チーム情報の更新 |
| PATCH | `/api/admin/camp-inquiries/[id]` | 合宿相談ステータス |

（他に `src/app/api/admin` 配下のファイルがあれば同様。）

---

## 15. 設計書との関係

詳細な業務フロー・Cron 時刻は **`docs/spec/design-mvp.md`** および **`docs/ops/mvp-day-before-runbook.md`** 等と照合すること。本書は **「画面に何があるか・どの API に触れているか」** の現状スナップショットである。

---

## 16. 見直し時のチェックリスト（任意）

- `/admin` の landing を **event-days** にする仕様でよいか（ダッシュボードへの統一など）。
- **`/admin/event-day-slots` プレースホルダ**を残すか、ナビから外すか、実装に置き換えるか。
- 開催日一覧で **`locked` 手動化**の要否（現状は自動運用前提）。
- 前日確定と予約一覧の **日付デフォルト**の揃え・運用導線。
- 合宿・予約・通知の **権限境界**（同一 `app_admins` で足りるか）。
