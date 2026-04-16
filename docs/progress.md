# 開発進捗チェックリスト（MVP）

和歌山サッカー交流試合システムの実装を、設計書どおりに漏れなく進めるためのチェックリストです。

**正本の仕様（リポジトリ内のファイル）:** `docs/spec/design-mvp.md`  
※ この行はリンクにしていません。エクスプローラーまたはファイル検索で開いてください。

---

## このファイルの使い方

- **Vercel 本番の動作確認:** ダッシュボードの **Deployments** に表示される本番 URL（例: `https://xxxx.vercel.app`）をブラウザで開き、トップが表示されればよい。環境変数を変えたあとは **Redeploy** が必要（`NEXT_PUBLIC_*` はビルド時に埋め込まれる）。
- 完了した作業は、該当行の `[ ]` を **`[x]`** に書き換えて保存する（Git で差分が進捗になる）。
- **プレビュー画面のクリックでは `.md` は自動保存されません。** エディタの**ソース表示**で編集してください。拡張機能「Markdown All in One」を入れている場合、行にカーソルを置いて **Alt+C**（タスクのトグル）が使えます。
- **クリックだけで進捗を残したい場合:** `npm run dev` のあとブラウザで `http://localhost:3000/dev/progress-tracker.html` を開く（`public/dev/progress-tracker.html`）。一覧は `npm run progress:sync` で本ファイルから再生成。チェックはブラウザの localStorage のみ（`docs/progress.md` とは別管理）。
- MVP の完了は、本ファイル末尾の「MVP完了の最終確認」まで `[x]` が付いた状態を目安にする。

---

## 目次（リンクなし・プレーンテキスト）

プレビューで青い「行き先のないリンク」にならないよう、**ジャンプ用の Markdown リンクは使いません。**  
本文へ移動するときは、エディタの検索（Ctrl+F）で見出しを探してください（例: `## 0.`、`## Phase 1`、`## MVP完了`）。

| 区分 | 概要 |
|------|------|
| 0. 準備・プロジェクト基盤 | アカウント、環境変数、ディレクトリ方針 |
| 1. Phase 1 — 予約の核 | DB、RLS、開催日・枠、公開予約、照会・取消、morning_fixed |
| 2. Phase 2 — 締切・編成・前日確定 | ロック、補完・編成、current run、通知、Cron |
| 3. Phase 3 — 運用補正・本番 | 雨天、枠、強制編集、ログ、テスト、デプロイ、引き継ぎ |
| 4. Phase 4 — MVP外・将来 | 参照用（必須ではない） |
| 横断 — 非機能・セキュリティ | 全フェーズで確認 |
| 横断 — テスト（設計書12章） | Unit / Integration / E2E |
| MVP完了の最終確認 | 成功条件・画面・API・JOB の検収 |
| 付録 | 週次目安・メモ |

---

## 0. 準備・プロジェクト基盤

### 0-1. アカウント・外部サービス

- [x] Supabase プロジェクトを作成する（PostgreSQL）
- [x] Vercel プロジェクトを作成し Git と連携する
- [x] メール送信サービス（Resend 等）のアカウント・送信ドメイン／From 方針を決める（**Resend 採用**。テストは `onboarding@resend.dev`、本番前に独自ドメイン検証で受信トレイ改善予定）
- [x] 本番とステージングで Supabase を分けるか同一か方針を決める（**別プロジェクトで Staging** とし、手順は `docs/setup-staging-supabase.md`）

### 0-2. リポジトリ・環境変数

- [x] ルートに `.env.local` を置き、必要なキーを定義する
- [x] 環境変数 `NEXT_PUBLIC_SUPABASE_URL` を定義する
- [x] 環境変数 `NEXT_PUBLIC_SUPABASE_ANON_KEY` を定義する
- [x] 環境変数 `SUPABASE_SERVICE_ROLE_KEY` をサーバー専用で定義する（クライアントに含めないことを確認）
- [x] メール送信用の API キー等のシークレットを定義する（`.env.example`・ローカル `.env.local`・Vercel Preview/Production の `RESEND_API_KEY` / `RESEND_FROM`）
- [x] Vercel Cron や管理用 API の認可に使うシークレットを定義する（採用する場合）（`CRON_SECRET`・ローカル `curl.exe` / 本番 Vercel Cron で締切ロック API 確認済み）
- [x] `.env.example` をコミットし、キー名のみ列挙する（値は書かない）
- [x] Vercel ダッシュボードに本番・プレビュー用の Environment Variables を登録する

### 0-3. ディレクトリ・コード方針（設計書 4-1）

- [x] `app/(public)/` を用意する（公開 UI）※実体は `src/app/(public)/`
- [x] `app/(admin)/` を用意する（管理 UI・認証ガード）※実体は `src/app/(admin)/`
- [x] `app/api/` に Route Handlers を置く※実体は `src/app/api/`（置き場所の用意まで。`route.ts` の実装は 1-4〜1-7 および末尾の API チェックリスト）
- [x] `domains/reservations/` `domains/matching/` `domains/notifications/` `domains/weather/` を段階的に用意する※実体は `src/domains/...`
- [x] `lib/db/` `lib/auth/` `lib/validators/` を用意する※実体は `src/lib/...`
- [x] `supabase/migrations/` に SQL migration を置く（`20260407120000_initial_schema.sql`・`20260407120100_enable_rls.sql`・`20260408140000_create_public_reservation_rpc.sql`・`20260409120000_remove_meal_orders_parking.sql`）※`supabase/config.toml` は `supabase init` 済み

### 0-4. 型・品質・CI

- [ ] Supabase 型生成方針を決める（CLI `gen types` 等）し、必要なら npm script を追加する
- [x] `npm run lint` が通るようにする
- [x] `npm run build` が通るようにする
- [x] Supabase CLI（`supabase`）を devDependency で入れ、`db:push` / `supabase` 用 npm script を定義する（PowerShell は実行ポリシーにより `npm.cmd run …` を使用）
- [ ] （任意）プルリク時に lint / build を回す CI を用意する

---

## 1. Phase 1 — 予約の核

**完了条件:** 午前枠の予約・照会・取消が通り、2件目で `morning_fixed` が DB に作られる。

### 1-1. データベース migration（設計書 7章）

**メモ:** ローカルリポジトリの migration は上記 4 本。リモート（リンク済みプロジェクト）へ **`npm.cmd run supabase -- login` → `link --project-ref …` → `db:push`** で適用済み（2026-04-09）。既に SQL Editor 等で入っていたオブジェクトと履歴がずれていた場合は **`migration repair <version> --status applied`** で履歴を整合してから push。`set_updated_at` に `SET search_path = public` を付与し Security Advisor の Function Search Path 警告を解消済み。**同じ初期 SQL を二重実行しない**（ENUM / table already exists 回避）。

**ENUM・区分値**

- [x] `event_days.status` に draft / open / locked / confirmed / cancelled_weather / cancelled_minimum を表現する
- [x] 天候用の内部状態（`weather_status` 等）と `event_days.status` を分離する
- [x] `reservations.status` に active / cancelled を表現する
- [x] `matching_runs.status` に success / failed を表現する
- [x] `match_assignments.status` に scheduled / cancelled を表現する
- [x] `teams.strength_category`（または同等）を strong / potential のみに制限する
- [x] `event_day_slots.phase` を morning / afternoon に制限する
- [x] `match_assignments.assignment_type` に morning_fixed / morning_fill / afternoon_auto を表現する

**テーブル（MVP）**

- [x] `teams` テーブルを作成する（`normalized_team_name` は NULL 可・将来用）
- [x] `event_days` テーブルを作成する（`UNIQUE(event_date)`）
- [x] `event_day_slots` テーブルを作成する（一意制約・時間 CHECK・容量・is_active・is_time_changed・is_locked）
- [x] `reservations` テーブルを作成する（token ハッシュ・participant_count CHECK）
- [x] `meal_orders` テーブルを作成する（reservation 1:1・meal_count CHECK）
- [x] `matching_runs` テーブルを作成する（is_current・部分一意で current 一意）
- [x] `match_assignments` テーブルを作成する（reservation_a ≠ reservation_b・referee_reservation_id・warning_json・manual 系）
- [x] `weather_decisions` テーブルを作成する
- [x] `notifications` テーブルを作成する
- [x] `reservation_events` テーブルを作成する
- [x] `settings` テーブルを作成する（meal_count 0 許容など）
- [x] `slot_change_logs` テーブルを作成する
- [x] `match_adjustment_logs` テーブルを作成する

**インデックス（設計書 7-5）**

- [x] `teams` に INDEX (team_name, contact_email) を付ける
- [x] `event_day_slots` に INDEX (event_day_id, phase, is_active) を付ける
- [x] `event_day_slots` に INDEX (event_day_id, phase, is_time_changed) を付ける
- [x] `reservations` に INDEX (event_day_id, team_id) を付ける
- [x] `reservations` に INDEX (selected_morning_slot_id, status) を付ける
- [x] `match_adjustment_logs` に INDEX (match_assignment_id, changed_at DESC) を付ける

**管理者と users**

- [x] Supabase Auth と admin 判定の方針を決める（`auth.users` のみ / `profiles` 等）
- [x] 管理 API・管理画面ルートに admin ガードを適用する（※`/admin/*` の `(protected)` で `getAdminUser`、管理 API は `POST/PATCH event-days` に適用済み）

### 1-2. RLS・データ更新経路（設計書 4-2・10章）

- [x] 方針: クライアントから anon でテーブルを直接更新しない
- [x] 公開予約・管理更新はサーバー（Route Handler 等）と service role または RPC で行う
- [x] 各テーブルで RLS を有効化し、ポリシーを最小限に設定する
- [x] service role キーがフロントのバンドルに含まれないことを確認する

### 1-3. 開催日・初期枠（設計書 3-1・5章）

- [x] 開催日作成時に既定枠（午前3・午後3＝計6枠）の `event_day_slots` を自動生成する ※`src/domains/event-days/default-slots.ts` と `POST /api/admin/event-days`（4+4 は管理から枠追加）
- [x] `slot_code`（MORNING_1〜3・AFTERNOON_1〜3 ほか追加枠）の一意性を担保する（※DB `UNIQUE(event_day_id, slot_code)` ＋初期データで固定コード）
- [x] 開催日に `grade_band`（1-2 / 3-4 / 5-6 等）を保持し、管理画面で登録できるようにする（※`CreateEventDayForm` と一覧表示）
- [x] `reservation_deadline_at`（前日12:00 JST を既定にしつつ任意時刻）を保持し、API で参照する（※`POST` で ISO 8601 受け取り。算出ロジックの共通化は任意）

### 1-4. 管理 API / UI（Phase 1 最小）

- [x] `POST /api/admin/event-days` で開催日の作成・更新と既定枠生成ができる（※作成＋`default-slots` 件数。状態の更新は `PATCH /api/admin/event-days/[id]` で draft/open）
- [x] `draft` / `open` など状態を管理画面から切り替えられる（※下書き・公開ボタン）
- [x] SCR-13 開催日管理の最小 UI を実装する（※`/admin/event-days`）
- [x] SCR-14 開催日枠管理（`/admin/event-days/{id}/slots`・時刻・有効・6/8 一括・枠追加・保存完了表示。予約あり時は編集ロック＋`/slots/force` で強制変更）

### 1-5. 公開 API（設計書 8章・10章）

- [x] `GET /api/event-days` で `open` の開催日のみ返す
- [x] レスポンスに個人情報（メール・電話）を含めない（※公開フィールドのみ選択）
- [x] `GET /api/event-days/{date}/availability` で各午前枠の件数・カテゴリ内訳を返す

### 1-6. 予約作成 API（設計書 8-2・3-4）

※実装は Route Handler（入力・UUID・HTTP マッピング）+ DB の `create_public_reservation`（1 TX・FOR UPDATE・業務検証）。

- [x] `POST /api/reservations` の入力バリデーション（participantCount、mealCount、カテゴリ、枠 ID）を行う
- [x] `event_day` が open かつ締切前であることを検証する
- [x] 選択枠が morning かつ is_active であることを検証する
- [x] 同日 active 予約が 6 未満であることを検証する
- [x] 対象 `event_day_slots` 行を `SELECT ... FOR UPDATE` でロックする
- [x] トランザクション内で枠あたり active が 2 未満であることを再検証し、満杯なら 409 を返す
- [x] team_name + contact_email で再利用候補を検索し、なければ新規 teams を作る（一意制約にしない）
- [x] 既存 team の contact / strength_category を更新し、team_name は原則上書きしない
- [x] is_active = false の team は予約不可にする
- [x] reservations と meal_orders を同一トランザクションで insert する
- [x] 枠に 2 件目の active が入ったら同一トランザクション内で `morning_fixed` の match_assignments を作成する
- [x] `morning_fixed` 即時作成時の `matching_run` の扱いを決め実装する（メモ欄に短文で記録）
- [x] reservation_token を生成し、DB にはハッシュのみ保存し、レスポンスで平文を返す
- [x] reservation_events に作成を記録する
- [x] 公開予約フォーム・`POST /api/reservations` から備考（remarks）入力を除外する（DB 列・RPC 引数は当面残し、空文字で NULL 相当）
- [x] 予約完了メールを送る（失敗時は notifications を failed にする）※RPC は `notifications` を `pending` で insert のみ（**Resend 送信は Route Handler**。Staging で `sent` 確認済み）
- [x] HTTP 400 / 404 / 409 / 422 を設計書 8-4 に沿って返す

### 1-7. 予約照会・取消 API（設計書 8-3）

- [x] `GET /api/reservations/{token}` でハッシュ照合する
- [x] 開催日から 30 日超えた token 照会は 404 にする
- [x] `POST /api/reservations/{token}/cancel` で締切前のみ cancelled にする
- [x] 取消時に関連する morning_fixed を cancelled にする（設計書 5-1・`cancel_public_reservation`）
- [x] `PATCH /api/reservations/{token}` で締切前・有効予約のみ、参加人数・昼食数・代表者名・電話を更新する（設計書外の運用拡張）
- [ ] 照会・取消・PATCH に強いレート制限を付ける
- [ ] ログに token 平文・個人情報全文を残さない

### 1-8. 公開 UI（設計書 6章・合宿導線）

- [x] SCR-01 開催日一覧・予約（午前枠 0/2・1/2・2/2、満席は不可）
- [x] 文言で「午前は予約で確定」「午後は前日自動」を明示する（一覧・予約日画面）
- [x] SCR-02 予約完了（token 表示・入力確認）
- [x] SCR-03 予約照会・取消・締切前の内容変更（保存完了の視覚的フィードバック含む）
- [x] `/reserve/contact` お問い合わせ（メール送信は未接続のプレースホルダー UI）
- [x] 合宿は案内＋日程相談（受付〜事前案内まで。当日運用・対戦表は非対象）（`/reserve/camp`・`/reserve/camp/inquiry`・`camp-lodging-plans.ts`・`POST /api/camp-inquiries`・`camp_inquiries`・schema v3・`/admin/camp-inquiries`・任意 `CAMP_INQUIRY_NOTIFY_EMAIL`）

### 1-9. マッチング関連の設計メモ（午前即時）

- [ ] 編成ロジック実装時に使うため、「同メールはなるべくマッチさせない」をコードレベルで解釈しメモする

### 1-10. Phase 1 検証

- [ ] 同一午前枠に 3 件目が入らない（409）
- [ ] 同日 7 件目が入らない（409）
- [ ] 2 件目で morning_fixed が存在する
- [ ] 取消後も照会でき、状態は cancelled と表示される
- [ ] 同一 team の同日複数 reservation が許容される

---

## 2. Phase 2 — 締切・編成・前日確定

**完了条件:** ロック後に午前補完・午後編成・通知まで一連で動き、管理画面で current run の結果が見える。

### 2-1. 締切ロック（設計書 9章 JOB01・14-2）

- [x] 前日 12:00（JST）を標準締切とし、`reservation_deadline_at <= now()` で `locked` にする処理を実装する（`GET /api/cron/lock-event-days`・Cron UTC `0 3` = 同日 JST 12:00。仕様: `docs/spec/reservation-deadline-and-event-status.md`）
- [x] ロック後は予約・取消・昼食変更を API で拒否する（`event_days.status` 非 `open` で RPC / Route が拒否）
- [x] 管理画面から同じロック処理を手動実行できるようにする（`PATCH /api/admin/event-days/[id]` で `open` → `locked`）
- [x] Vercel Cron からも同じ処理を呼べるようにする（`vercel.json` の `crons` → 同エンドポイント・`Authorization: Bearer`）

### 2-2. 午前補完（設計書 5-2）

- [x] 締切時点の active reservation 全集計を行う ※`buildMatchingAssignments` / `admin_apply_matching_run`
- [x] 既存 morning_fixed 枠を確定済みとして扱う
- [x] 1 チームのみの午前枠を優先して埋める（アルゴリズム詳細は `docs/spec/matching-algorithm-impl.md`）
- [x] 候補順（カテゴリ一致 → 枠未割当 → 対戦被り回避 → 割当回数）を実装する
- [x] カテゴリ跨ぎを許容し、必要なら warning を付ける
- [x] 0 チーム枠は最後に扱い、3〜6 チームの範囲で成立可能な場合のみ埋める

### 2-3. 午後編成（設計書 5-3）

- [x] 全員に午後 1 試合を優先して割り当てる
- [x] 候補順（カテゴリ一致 → 午前対戦と被らない → 同日重複が少ない相手）を実装する
- [x] 6 チーム未満で枠が余るときのみ 2 試合目を割り当てる
- [x] カテゴリ跨ぎを許容する
- [x] 重複回避できない場合は warning を付け成立優先で確定する

### 2-4. 審判候補（設計書 5-4）

- [x] 午後各試合で当事者以外から審判候補 reservation を 1 件選ぶ
- [x] DB 上は `referee_reservation_id` に統一する（設計書の referee_team_id 表記との差を吸収）
- [x] 候補がいなければ NULL とし referee_unassigned を warning に入れる

### 2-5. warning コード（設計書 5-5）

- [x] cross_category_match を記録できる
- [x] duplicate_opponent を記録できる
- [ ] double_assigned_reservation を記録できる（コード体系はあるが assignment warning への統一は要確認）
- [x] referee_unassigned を記録できる
- [ ] unfilled_slot を記録できる（メタ注記のみ・warning_json への固定付与は未）

### 2-6. matching_runs・current（設計書 5-6・5-7）

- [x] 新規 run が success のとき、同一 event_day の旧 is_current を false にする
- [x] 新 run のみ is_current = true にする
- [x] 部分一意制約で current が二重にならないことを確認する
- [x] 編成成功後に `event_days.status` を `confirmed` に更新する

### 2-7. 管理 API・画面

- [x] `POST /api/admin/matching/run` を実装する（admin または Cron シークレット・MVP 簡略ロジック・`admin_apply_matching_run` RPC）
- [x] `GET /api/admin/matches?date=...` で current run の assignments のみ返す（`src/app/api/admin/matches/route.ts`）
- [x] SCR-11 前日確定結果一覧（午前・午後・審判・warning）※`/admin/pre-day-results`・`GET /api/admin/matches`
- [x] SCR-10 運用ダッシュボード（`/admin/dashboard`・東京の今日以降で直近1件の開催サマリー・昼食/人数・「次の開催日を読み込む」連鎖・`GET /api/admin/dashboard/next-event-day`・前日確定リンク・運用ドキュメントパス）

### 2-8. 通知（設計書 9章 JOB03）

- [x] 前日確定通知（JOB03）の本文に対戦予定・雨天メモを含める（最終版テンプレ `day_before_final`・中止時も同一テンプレで出し分け）
- [x] 送信失敗を notifications に failed で残す（`reservation_created` / `day_before_final` / `weather_cancel_immediate`）

### 2-9. Cron（Vercel）

- [x] vercel.json で JOB01〜03 を登録する（UTC `0 3` 締切ロック / `1 3` 編成 / `30 4` 前日13:30メール。いずれも JST 前日フローに整合）
- [x] Cron 用エンドポイントをシークレットヘッダ等で保護する（`CRON_SECRET`・Bearer 不一致は 401）

### 2-10. 開催最低人数（設計書 2-2）

- [ ] 締切時点で active が 3 未満のときの扱い（cancelled_minimum 等）を実装し、運用手順に書く

### 2-11. Phase 2 検証

- [ ] ステージングで予約→ロック→編成→confirmed→通知まで通す
- [ ] 編成再実行で履歴 run が残り、画面は current のみを見せる

---

## 3. Phase 3 — 運用補正・本番

**完了条件:** 雨天判断、枠操作、強制編集、ログ、本番デプロイ、現場向け手順まで揃う。

### 3-1. 開催日枠の管理 API・UI（設計書 3-2・3-3）

- [x] `GET /api/admin/event-days/{id}/slots` を実装する
- [x] `PATCH /api/admin/event-days/{id}/slots` で時刻・`is_active` を更新する（**active 予約 0 件**かつ `draft`/`open` のみ。予約ありは 409）
- [x] `POST /api/admin/event-days/{id}/slots` で枠1本追加（同上条件＋枠数ポリシー）
- [x] `PATCH` / `POST` `/api/admin/event-days/{id}/slots/force` … 予約残存時の強制変更（`acknowledgeReservationRisk: true` 必須・別確認 UI）
- [ ] 開始＜終了、同一 phase で時間重複なしを検証する（開始＜終了のみ実装。重複検証は未）
- [x] 予約がある開催日では通常 API で枠変更不可（設計書 §3-3 の「実装寄せ」）
- [x] 枠 `PATCH` 保存で `is_time_changed = true` を付与（予約有無に関わらず一括付与）
- [ ] slot_change_logs に監査を残す
- [x] SCR-14 枠管理 UI を実装する（`/admin/event-days/{id}/slots`・強制は `/slots/force`）

### 3-2. 雨天判断（設計書 2-8・9章 JOB04）

- [x] `POST /api/admin/event-days/{id}/weather-decision` で go / cancel を保存する
- [x] cancel 時に weather と event_days.status の整合（cancelled_weather）を取る
- [x] go は主状態（open/locked/confirmed）を壊さない（中止からの復帰時のみ `confirmed` に戻す）
- [ ] 矛盾する組み合わせの更新を API で拒否する
- [x] 雨天 cancel でもデータを削除しない（実装方針どおり保持）
- [x] 雨天判断を前日13:30の最終メールに含める（例外: 即時 `weather_cancel_immediate`）
- [x] 開催日管理から雨天判断ページへ導線（`/admin/event-days/{id}/weather`）

### 3-3. 強制編集（設計書 5-7・8章）

- [x] `PATCH /api/admin/matches/{id}` でチーム差し替え（reservation 単位）と枠変更を行う（午後枠移動のみ・監査ログ付き）
- [x] manual_override と override_reason を必須にする
- [x] match_adjustment_logs に before/after を残す
- [x] 同一試合で同一 team 不可・同一時刻に同一 team 重複不可・芝1面で同一時刻に複数試合不可を維持する
- [x] SCR-12 補正 UI を実装する

### 3-4. ログ・監査（設計書 11章）

- [ ] reservation_events で作成・取消を追えるようにする
- [ ] notifications で channel / status / 関連 ID を追えるようにする
- [ ] error_logs を DB 化するか、サーバーログ＋最小 DB で足りるか決めて実装する
- [ ] 公開 API 全体にレート制限を付ける（照会・取消は特に強く）

### 3-5. テスト（設計書 12章）

- [x] Unit: `event-day-slot-count-policy`（枠数 3+3 / 4+4 ポリシー）
- [x] Unit: `build-matching-assignments-target`（編成の一部ケース）
- [ ] Unit: 予約（6 上限・2 枠・reuse・複数 reservation・morning_fixed）
- [ ] Unit: 締切前後の予約・取消
- [ ] Unit: 午前補完
- [ ] Unit: 午後編成
- [ ] Unit: 審判候補
- [ ] Unit: weather_status と event_days.status の矛盾防止
- [ ] Unit: matching_runs の current 管理
- [ ] Integration: 予約→締切→補完→編成→current 切替（一部は `tests/integration/public-reservation-rpc`・`cron-lock-route` でカバー、E2E 相当は未）
- [ ] Integration: 雨天 cancel と通知
- [ ] Unit: is_time_changed（予約後の枠時刻変更）
- [ ] Unit: 枠無効化（予約なしのみ・公開・編成から除外）
- [ ] Integration: 強制編集と監査ログ
- [ ] E2E: 公開予約（作成・照会・取消）— 工数不足なら手動テストシートを `docs/` に置く
- [ ] E2E: 管理 UI（開催日・枠・編成・結果表示）— 同上

### 3-6. 本番リリース・引き継ぎ

- [x] 本番 Supabase に migration を適用する（※リンク済みリモートへ `db push` 完了。別環境があれば同手順で未適用分のみ）
- [x] Vercel 本番の環境変数を設定する（**一覧・手順:** `docs/ops/vercel-production-checklist.md` §1。値の入力は運用者が Vercel で実施）
- [x] Cron を本番で有効化し、時刻を最終確認する（**手順:** 同チェックリスト §2・`vercel.json` 正本）
- [x] 管理者ユーザの作り方を手順書に書く（**手順:** 同チェックリスト §3・`docs/progress.md` の「A. 運用・Supabase」）
- [x] 現場向けオペレーション1枚（ロック→編成→結果確認→通知失敗時→雨天）を書く（**`docs/ops/mvp-day-before-runbook.md`**）
- [x] ログに個人情報・token が出ていないか確認する（**確認観点:** `docs/ops/vercel-production-checklist.md` §6。コード監査は未完了なら別途）

---

## 4. Phase 4 — MVP外・将来（参照）

- [ ] （将来）決済 payment_status / payment_id
- [ ] （将来）対戦相手の直接組み替え
- [ ] （将来）通知の再送・督促自動化
- [ ] （将来）team 統合 UI と監査ログ
- [ ] （将来）lane による1面2分割
- [ ] （将来）token 再送 API（設計書 8-3-1）
- [ ] （将来）event_days.status に completed 等
- [ ] （将来）api_logs の本格化

---

## 横断 — 非機能・セキュリティ（設計書 4-2・8-4・10-1）

- [x] 管理系の更新はすべてサーバー経由である（Route Handler + service role／RPC）
- [ ] 予約・締切・編成・雨天はトランザクションで整合を取る（予約・締切ロック・編成 RPC は概ね TX。雨天は未）
- [x] 公開 API はサーバー側バリデーション必須である（実装済み Route 範囲）
- [ ] 個人情報は管理画面以外に表示しない
- [ ] ログにメール・電話・token 平文を残さない
- [ ] HTTP ステータス（400/401/403/404/409/422/500）の方針を API で統一する

---

## 横断 — テスト一覧の再掲（設計書12章）

設計書 12 章の表と 3-5 のチェックを重複確認するための行です。

- [ ] Unit: 予約作成
- [ ] Unit: 締切判定
- [ ] Unit: 午前補完
- [ ] Unit: 午後編成
- [ ] Unit: 審判候補
- [ ] Unit: 状態整合
- [ ] Integration: 予約→締切→補完→編成
- [ ] Integration: 雨天判断
- [ ] E2E: 公開予約 UI
- [ ] E2E: 管理 UI
- [ ] Unit: 枠変更フラグ
- [ ] Unit: 枠無効化
- [ ] Integration: 強制編集

---

## MVP完了の最終確認

### 設計書の成功条件

- [x] 公開画面で午前枠の埋まり状況が直感的に分かる（SCR-01・availability）
- [x] 締切後に午前補完・午後編成・前日確定通知が一連の処理で完結する（Cron JOB01〜03・手動 `curl` でも同 API 可）
- [x] 管理画面で午前・午後・審判候補・warning を確認できる（SCR-11）
- [x] 管理画面で枠追加・枠無効化・時刻変更・チーム差し替え・枠変更ができる（試合割当の補正は SCR-12・午前枠移動は未）

### 画面（設計書 6章）— すべてチェックリスト

- [x] SCR-01 開催日一覧・予約
- [x] SCR-02 予約完了
- [x] SCR-03 予約照会・取消（締切前の内容変更含む）
- [x] SCR-10 管理ダッシュボード
- [x] SCR-11 前日確定結果一覧
- [x] SCR-12 前日確定補正
- [x] SCR-13 開催日管理
- [x] SCR-14 開催日枠管理（通常＋予約あり時の強制変更画面）

### API（設計書 8章）— すべてチェックリスト

- [x] GET /api/event-days
- [x] GET /api/event-days/{date}/availability
- [x] POST /api/reservations
- [x] GET /api/reservations/{token}
- [x] POST /api/reservations/{token}/cancel
- [x] PATCH /api/reservations/{token}（締切前・人数・昼食・連絡先）
- [x] POST /api/admin/event-days
- [x] GET /api/admin/event-days/{id}/slots
- [x] PATCH /api/admin/event-days/{id}/slots（予約ゼロ時のみ）
- [x] POST /api/admin/event-days/{id}/slots（予約ゼロ時のみ）
- [x] PATCH /api/admin/event-days/{id}/slots/force（強制・ack 必須）
- [x] POST /api/admin/event-days/{id}/slots/force（強制・ack 必須）
- [x] POST /api/admin/matching/run
- [x] GET /api/admin/matches?date=...
- [x] POST /api/admin/event-days/{id}/weather-decision
- [x] PATCH /api/admin/matches/{id}

### バッチ JOB（設計書 9章）

- [x] JOB01 締切ロック（前日 12:00 JST 想定）※`GET /api/cron/lock-event-days`・Vercel Cron `0 3 * * *`
- [x] JOB02 午前補完・午後一括編成（前日 12:01 JST 想定）※`GET /api/cron/run-matching-locked`・`POST /api/admin/matching/run` と同一ロジック
- [x] JOB03 前日最終メール（13:30 JST 想定）※`GET /api/cron/send-day-before-final`（`day_before_final`）
- [x] JOB04 雨天判断の例外通知（登録時オプションで即時 `weather_cancel_immediate`）。標準は JOB03 に統合

### 設計書 15章・確定事項の反映確認（仕様どおり実装したか）

- [x] 初期 slot 時刻が設計どおりである（既定6枠・`default-slots.ts`）
- [x] 午前・午後の初期枠数と管理者による枠増減方針が実装と一致する（3+3 初期・4+4 までポリシーで追加）
- [x] カテゴリが strong / potential のみである
- [x] team は予約時に自動作成・再利用される
- [x] team 再利用キーが team_name + contact_email（候補用・非一意）である
- [x] reservation.status が active / cancelled である
- [x] event_days.status が設計の一覧を満たす（DB ENUM・遷移は実装範囲に準拠）
- [x] 午前確定が 2 件で即 morning_fixed である
- [x] 通知が予約完了・前日最終版（雨天含む）・緊急雨天のみである（テンプレ: `reservation_created` / `day_before_final` / `weather_cancel_immediate`）
- [x] matching_runs.is_current で有効版を一意に保つ
- [x] warning が設計のコード体系である（主要コードは `buildMatchingAssignments`・一部コードは未付与）
- [x] meal_count は初期 1 以上、settings でのみ 0 許容
- [x] 枠変更は **通常 API は予約ゼロ時のみ**（予約ありは強制 API）。締切は `status` ではなく別チェックなし（`open` かつ予約0で編集可）
- [x] 枠 PATCH で is_time_changed が付く（一括 true）
- [x] 強制編集は admin のみ（枠強制は admin・試合 `PATCH matches` は実装済）
- [x] 同一 team の同日複数 reservation が許容され、編成は reservation 単位である

---

## 週次目安（参考・4/30 まで・平日7h）

| 週 | 目安 | 主なゴール |
|----|------|------------|
| 第1週 | DB・認証・開催日＋初期枠 | migration と管理から開催日作成 |
| 第2週 | 予約 API・公開 UI・token・メール | SCR-01〜03 が通る |
| 第3週 | 締切・編成・確定表示・通知・Cron | 前日フローがステージングで回る |
| 第4週 | 雨天・枠・強制編集・本番・検収 | 現場オペ手順まで |

---

## メモ欄（実装判断の記録）

（チェックリストにしない自由記述）

### 作業再開メモ（次セッション）

- **完了済み:** 上記に加え `/admin/login`（メール・パスワード）、`/admin` リダイレクト、`(protected)` レイアウトで `getAdminUser` ガード・ログアウト、SCR-13 最小の開催日一覧＋作成フォーム＋下書き/公開トグル、`PATCH /api/admin/event-days/[id]`（draft/open のみ）、`GET /api/event-days`（open のみ・公開用フィールド）、`GET /api/event-days/[date]/availability`、`POST /api/reservations`（Route + `create_public_reservation` RPC・駐車なし）。**2026-04-09:** Supabase CLI を devDependency 化、`supabase init`、`link`、`db push` でリモートに migration 4 本を適用（必要箇所は `migration repair` で履歴整合）。**2026-04-07:** 予約完了メール（Resend・`src/lib/email/reservation-created-mail.ts`）、Vercel で Preview/Production に Supabase と Resend を分離、Staging で `notifications.sent` まで確認（初回は迷惑メールフォルダに入りやすい）。Resend 未設定時はサーバーログに警告（`chore: Resend 未設定時に…`）。
- **次にやる（次セッションの続き）:** `main` へマージするか判断し、本番にメール用環境変数を入れて再デプロイ。Resend 独自ドメインで受信トレイ改善。progress **1-10** の手動テスト（枠 3 件目 409 等）。Phase 2（締切・編成・Cron）へ。レート制限・ログ方針（1-7 末尾）。

- morning_fixed 即時作成時の matching_run の扱い: **同一枠 2 件目**のとき、当該 `event_day_id` に `is_current = true` の行が無ければ `create_public_reservation` 内で `matching_runs` に `success`・`is_current=true` を INSERT してから `match_assignments` を挿入。
- タイムゾーン（JST 固定か、event に TZ を持つか）:
- admin ロールの付与方法: **`public.app_admins`** に Supabase Auth の `user_id`（`auth.users.id`）を 1 行 INSERT。`is_app_admin()` は `SECURITY DEFINER` + `SET search_path = public`。管理用の DB 直参照は `app_admins` 登録ユーザのみ（authenticated ポリシー）。業務更新の主経路は Route Handler + **service_role** 推奨。
- その他:

### 次にやること（ここからの手順・詳細）

正本仕様は `docs/spec/design-mvp.md`（特に §3 時間枠・§5 フロー・§8 API・§10 セキュリティ）。チェックは `docs/progress.md` の 1-3〜1-10 と末尾の API 一覧。

---

#### A. 運用・Supabase（未了があれば）

1. **管理用 Auth ユーザー**  
   Supabase Dashboard → Authentication → Users でユーザーを 1 人用意する（メール＋パスワード等）。

2. **`app_admins` 登録**  
   SQL Editor（Role: postgres）で  
   `INSERT INTO public.app_admins (user_id) VALUES ('<auth.users の UUID>');`  
   自分の UUID は Users 一覧からコピー。

3. **疎通確認**  
   Table Editor で `event_days` / `event_day_slots` / `app_admins` が見えること。Security Advisor を再スキャン（警告が残る場合は内容に応じて対応）。

4. **migration 履歴**  
   いま SQL Editor 手実行なら、将来 CLI を使う場合に備え「リモートとリポジトリの migration の突き合わせ方針」だけ決めてメモ（本番反映は 3-6）。

---

#### B. アプリ基盤（サーバーから DB に触る準備）

1. **`src/lib/supabase/service.ts`（名前は任意）**  
   `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })` のような **service role 専用**ファクトリを 1 箇所に集約。  
   **import できるのは Server のみ**（`route.ts`・Server Actions・`server-only` 付与などでクライアントから参照されないようにする）。

2. **秘密がクライアントに乗らないことの確認**  
   `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_*` にしない。`rg` / エディタ検索で `SERVICE_ROLE` が `src/app/**/*.tsx` や `client.ts` から参照されていないことを確認。`npm run build` 後、必要なら `.next` 内にキー文字列が含まれないか spot 確認。

3. **（任意・0-4）型**  
   `supabase gen types typescript --project-id ...` 等で `Database` 型を生成し、`src/lib/db/` で利用。未導入なら当面 `as any` 最小で進めてもよい。

---

#### C. 初期枠のドメインロジック（1-3）

設計書 **§3-1 表**どおり、開催日に紐づく 6 行を定義する関数または定数を `src/domains/` 側に置く。

| slot_code   | phase     | start | end   |
| ----------- | --------- | ----- | ----- |
| MORNING_1   | morning   | 09:00 | 10:00 |
| MORNING_2   | morning   | 10:00 | 11:00 |
| MORNING_3   | morning   | 11:00 | 12:00 |
| AFTERNOON_1 | afternoon | 13:00 | 14:00 |
| AFTERNOON_2 | afternoon | 14:00 | 15:00 |
| AFTERNOON_3 | afternoon | 15:00 | 16:00 |

- `capacity = 2`、午前・午後は ENUM `morning` / `afternoon` と一致させる。  
- **`reservation_deadline_at`** は「開催前日 12:00（JST 想定・運用上の標準）」のルールを決め、メモ欄の「タイムゾーン」に一文書く（例: DB は `timestamptz`、計算は Asia/Tokyo）。

---

#### D. 管理 API・認可（1-4・1-1 管理者ガード）

1. **`POST /api/admin/event-days`**（または REST に沿ったパス）  
   - リクエスト例: `event_date`, `grade_band`, `status`（初期 `draft`）, `reservation_deadline_at`（またはサーバー側で前日 12:00 から算出）。  
   - **同一トランザクション**で `event_days` 1 行 insert の直後に、上記 C の 6 枠を `event_day_slots` に bulk insert。  
   - 更新時は既存行の更新方針（同日 UNIQUE・枠の再生成はしない等）を決めて実装。

2. **admin ガード**  
   - **推奨:** Cookie セッション（既存 `createServerClient`）で `auth.getUser()` し、DB で `app_admins` に含まれるか照会（または RPC `is_app_admin()` を叩く）。含まれなければ **401/403**。  
   - **代替:** 共有シークレットヘッダ（Cron や緊急用）。Phase 1 の画面操作はセッション方式がよい。

3. **SCR-13 最小 UI**  
   `src/app/(admin)/` に開催日 1 件作成フォーム＋一覧（`draft` / `open` 切替ができればよい）。枠一覧だけでも可（SCR-14 本実装は Phase 3）。

---

#### E. 公開 API（1-5）

1. **`GET /api/event-days`**  
   `status = open` のみ、`event_date` 昇順など。レスポンスに **メール・電話を含めない**（設計 §10）。

2. **`GET /api/event-days/[date]/availability`**（パスはプロジェクトで統一）  
   対象日の **午前枠ごと**に active 予約件数（0/1/2）と、strong/potential の内訳が取れる形（設計 §6-1・§8）。

---

#### F. 予約作成 API（1-6・難所）

`POST /api/reservations` を **service role + 1 トランザクション**で実装。

1. バリデーション（participantCount、mealCount、枠 ID、カテゴリ ENUM 等）。  
2. `event_days` が `open` かつ締切前。  
3. 枠が `morning` かつ `is_active`。  
4. 同日 active 予約が **6 未満**。  
5. 対象 `event_day_slots` 行を **`SELECT ... FOR UPDATE`**。  
6. 枠内 active が **2 未満**を再確認、満杯なら **409**。  
7. **team:** `team_name` + `contact_email` で候補検索 → なければ insert / あればルールどおり更新（設計 §7-6・名寄せ）。`is_active = false` の team は拒否。  
8. `reservations` + `meal_orders` を insert。  
9. 枠が **2 件目**になったら同一 TX で `match_assignments`（`morning_fixed`）を作成。**`matching_run` をどう付けるか**はメモ欄「morning_fixed 即時…」に決め打ちを短く書く。  
10. **token:** 十分な長さのランダム → レスポンスは平文 1 回のみ、DB はハッシュのみ。  
11. `reservation_events` に action 記録。  
12. HTTP コードは設計 **§8-4**（400/404/409/422 等）。

---

#### G. 照会・取消 API（1-7）

1. **`GET /api/reservations/[token]`**  
   平文 token をハッシュ化して `reservation_token_hash` と照合。開催日から **30 日超**は 404 等（設計 §8-3）。

2. **`POST /api/reservations/[token]/cancel`**  
   締切前のみ `cancelled`。関連 `morning_fixed` を `cancelled` に（設計 §5-1）。

3. **`PATCH /api/reservations/[token]`**（運用拡張）  
   締切前・`active` のみ、参加人数・昼食・代表者名・電話を更新。

4. **レート制限**  
   Middleware または Route 内で IP / token 単位の粗い制限の土台を置く。

5. **ログ**に token 平文・個人情報全文を残さない。

---

#### H. 公開 UI（1-8）

1. **SCR-01** 開催日一覧・午前枠 0/2・1/2・2/2、満席は選択不可。  
2. 文言で「午前は予約で確定」「午後は前日自動」。  
3. **SCR-02** 完了画面で token 表示。  
4. **SCR-03** 照会・取消・締切前の PATCH 変更。保存完了は画面上で明示。  
5. **お問い合わせ** `/reserve/contact` はプレースホルダー（メール API 未接続）。  
6. 合宿導線は案内＋相談フォーム（受付〜事前案内まで。`design-mvp` 合宿節参照）。

---

#### I. 通知（0-1・1-6）

Resend 等のアカウントと API キー（0-1）が決まったら、予約完了時にメール送信。失敗時は `notifications` に `failed` で残す（設計 §9 周辺・progress 1-6）。

---

#### J. 完了の確認（1-10）

手動または自動テストで、progress **1-10** の項目（枠 3 件目 409、同日 7 件目 409、2 件目で `morning_fixed`、取消後の表示、同一 team 同日複数予約）を潰す。

---

#### K. 任意・あとで

- `npm run progress:sync`（`docs/progress.md` を直したあと HTML 用 JSON を更新）。  
- 本番 Supabase への同 migration 適用（3-6）。  
- CI（0-4）。

---

## 作業ログ（直近・手動メモ）

- **2026-04-07** — 公開予約から備考（remarks）入力を削除。`PATCH /api/reservations/[token]` で締切前に参加人数・昼食数・代表者名・電話のみ更新。`/reserve/contact` をメール未接続のお問い合わせ UI（プレースホルダー）として追加しナビにリンク。予約確認画面で「変更を保存」後に成功表示が消える不具合を修正し、完了メッセージの強調表示とスクロールで視認性を改善。
- **2026-04-07（続き・MVP 進捗）** — 予約完了メールを Resend で送信（`POST /api/reservations` 成功後・`notifications` は `sent`/`failed`）。Vercel の Preview に Staging Supabase、Production に本番 Supabase を割り当て。`RESEND_*` / `NEXT_PUBLIC_SITE_URL` を Preview に設定。Staging の管理者（Auth + `app_admins`）を登録。迷惑メールフォルダに届くケースを確認。`RESEND` 未設定時はサーバーログへ警告を出す変更を `staging` に反映。
- **2026-04-13** — 合宿占有（`camp_status`）は方針変更のため撤去（マイグレーション `20260415140000_remove_event_days_camp_status.sql` ほか・関連 API/UI 削除）。ローカルで `GET /api/cron/lock-event-days`（Bearer `CRON_SECRET`）→ `event_days` が `locked` になることを確認。進捗: 0-4 Cron シークレット・Phase 2 の締切ロック・Cron 保護をチェック更新。**次セッション:** Resend 本番 From／ドメイン検証、Phase 2/3 の `[ ]` から次リリース分を1件着手。
- **2026-04-14** — `GET /api/admin/matches`、`POST /api/admin/matching/run` と DB RPC `admin_apply_matching_run`（`20260421100000`）。**各環境で `db push`。** 再実行は afternoon 済みなら 409。編成後 `confirmed`。**同日** 午前ペアのグローバル最適化・0枠埋め（3〜6 のみ）・午後2巡目（6 未満）・審判は次枠優先。実装仕様は `docs/spec/matching-algorithm-impl.md`。
- **2026-04-15** — 枠管理: active 予約がある開催日は通常 `PATCH/POST .../slots` を 409 で拒否。`.../slots/force` ＋ `/admin/event-days/{id}/slots/force` で同意確認付き強制変更。共有処理 `admin-event-day-slot-mutations.ts`。設計書 §3・`reservation-deadline-and-event-status.md` を更新。進捗チェックリストを実装状況に同期（Phase 2 編成コア・枠 API・SCR-14 等）。
- **2026-04-15（続き）** — SCR-10: `/admin/dashboard` に active 予約数・`notifications` failed/pending・開催日ステータス別件数・近日開催表（前日確定／枠／雨天リンク）。運用: `docs/ops/mvp-day-before-runbook.md`、本番: `docs/ops/vercel-production-checklist.md`。進捗 3-6 の手順系を `[x]` 化。
- **2026-04-15（続き2）** — 管理を3画面軸に整理: ナビはダッシュボード／開催日／前日確定のみ。SCR-10 は「今日やること」＋7日表＋週送り。SCR-12 は `pre-day-results` のタブへ統合、`/admin/pre-day-adjust` は `?tab=adjust` へリダイレクト。
- **2026-04-15（続き3）** — SCR-12 実装: `PATCH /api/admin/matches/[id]`（予約 A/B 差し替え・審判・午後のみ枠移動・`manual_override`/`override_reason`/`match_adjustment_logs`）。`GET /api/admin/matches` に `activeReservations` 追加。補正タブ UI（`pre-day-adjust-client.tsx`）。検証ヘルパの Vitest。
- **2026-04-15（続き4）** — SCR-10 再設計: ダッシュは明日（東京）1枚＋昼食/参加人数/failed（当該開催日）・`GET /api/admin/notifications`・前日確定 `?notifications=failed#notifications-failed`。
- **2026-04-15（続き5・本日終了）** — SCR-12 補正: 試合行ドロップダウンを廃止し枠・試合一覧（表／狭幅はカード）で行選択。レスポンシブ・`morningOccupants` 型・`canPatch` 時のみ選択可。SCR-10: 直近1件→「次の開催日を読み込む」でサマリ連鎖（`dashboard-upcoming-chain.tsx`・集計は `lib/admin/dashboard-event-day-summary.ts`）。前日確定: `?date=` 無し時の初期日付を「東京の今日以降で最も早い `event_days`」（当日優先・`getNearestUpcomingEventDateIso`）。ローカル Cron 検証用に `npm run cron:local-day-before`（`scripts/run-local-day-before-cron.mjs`）・`docs/ops/local-day-before-cron.md`・`.env.example` に任意 `LOCAL_CRON_BASE_URL`・runbook / 本番チェックリストからリンク。
