# 自動テスト・CI・手動 QA のベースライン（MVP 最小）

**Excel 用の一覧（仕様 ID 単位）:** `docs/qa/MVP_TestSpec_Source.csv`（MVP_Minimum_Run を主に、CI・integration・メタ行・**台帳状態・MVP前後**・件数サマリを同梱）

**Excel 取込用（実施記録列付き・UTF-8 BOM）:** `docs/qa/MVP_TestSpec_Excel_Export.csv`（`MVP_TestSpec_Source.csv` と同一内容に実施者・日付・結果等の空列を付与。`node scripts/generate-mvp-testspec-excel-export.mjs` で Source から再生成）

**方針:** 広く網羅しない。**毎回の CI は unit のみ**。結合はローカル（またはシークレット整備済み CI）で **`npm run test:integration`**。マッチングの純関数 unit は一段落として扱い、詳細な枠数・警告の考え方は下記「マッチング unit（参照）」へ。

**integration の前提（重要）:** `npm run test:integration` は **結合専用のローカル Supabase** を想定する（`supabase start` かつ **`supabase db reset` で空に近い状態** を推奨）。**共有のローカル DB・本番系 URL では実行しないこと。** 一部のテストは開始時に `matching_runs` → `reservations` → `event_days` の順でデータを削除するため、**他用途の `event_days` 行も消える**。

---

## 1. CI で毎回回す対象（最小セット）

| 対象 | コマンド | 前提 | 備考 |
|------|----------|------|------|
| **必須（毎 PR / push）** | `npm run test:unit` | Node + `npm ci` のみ | **DB・Supabase 不要**。`vitest.config.ts` → `tests/unit/**/*.test.ts`（現状 **60 テスト**）。 |
| **含めない（デフォルト）** | `npm run test:integration` | **結合専用**ローカル Supabase + `.env.test`（または CI に同等シークレット） | RPC・DB 依存。**上記のとおり DB を掃除するテストあり**。GitHub 既定ではシークレット未設定のことが多いため **ワークフローには載せない**。 |
| **含めない** | `npm run test:staging` | ステージング URL・環境変数 | 手元 / 専用パイプライン向け。 |

**実装:** `.github/workflows/ci.yml` の `unit` ジョブが `npm run test:unit` のみ実行する。

**ローカル開発での推奨:**

```bash
npm run test:unit
npm run test:integration   # supabase start && db reset && .env.test 済みのとき
```

---

## 2. MVP で最優先の「縦割り integration」候補（最大 3 件）

| 順位 | 候補 | 壊れると困ること | 備考 |
|------|------|------------------|------|
| **A（採用済み・1 本目）** | **`admin_apply_matching_run`**（締切後の編成を DB に一括適用） | 開催日が `confirmed` にならない／割当が壊れる／二重適用 | `buildMatchingAssignments` の unit では触れない **DB + RPC** の境界。 |
| **B** | **公開予約 RPC の追加縦割り**（例: 締切直前の境界、キャンセル後の再予約） | 予約不能・二重予約・締切誤判定 | 既存 `public-reservation-rpc.integration.test.ts` を拡張する形が自然。 |
| **C** | **管理 API の 1 経路**（例: `POST /api/admin/event-days` → 枠行生成） | 開催日が作れない | service_role + 認証モックが要る場合があり、**B より重い**ことが多い。 |

---

## 3. 最初に実装した 1 本（採用内容）

**ファイル:** `tests/integration/admin-apply-matching-run.integration.test.ts`

1. **`locked` 以外**に対して `admin_apply_matching_run` を呼ぶ → **`not_locked`** で拒否され、`event_days.status` が変わらないこと。  
2. **`open` で `create_public_reservation` を 3 件** → **`locked` に更新** → DB から枠・予約を読み **`buildMatchingAssignments`** → **`admin_apply_matching_run`** → **`confirmed`**、**`matching_runs.is_current`** と **`match_assignments` が 1 件以上**であること。

既存の `create_public_reservation`・`insertEventDayWithSlots`・`deleteEventDayById` を流用している。

---

## 4. その 1 本に必要な最小 seed セット

| 要素 | 内容 |
|------|------|
| `event_days` | `insertEventDayWithSlots`（`status: open` → テスト後半で `locked`）。`reservation_deadline_at` は未来（既存テストと同様の ISO）。 |
| `event_day_slots` | 上記ヘルパ内で `toEventDaySlotRows` により **6 枠運用初期形**（M4/A4 inactive）を投入済み。 |
| `reservations` + `teams` | **`create_public_reservation` RPC を 3 回**（午前 active 枠を 1 枠ずつ割り当て、メールはテストごとにユニーク）。 |
| 編成 payload | **`buildMatchingAssignments`** の戻り `assignments` をそのまま `p_assignments` に渡す。 |
| 掃除 | **`deleteEventDayById(eventDayId)`**（`finally`）。 |

**補助修正:** `tests/integration/helpers/seed-event-day.ts` の `nextUniqueEventDate` は、DB に残ったテスト用 `event_date` と衝突しないよう **ランダムオフセット付き**に変更済み。

---

## 5. 手動 QA に残すべき項目（自動化しない／まだ載せない範囲）

次は **人が目で確認する前提**でよいものの例（`docs/qa/MVP_Minimum_Run.csv` 等と照合）。

- **画面操作の体験**: 予約フォーム、管理画面の開催日作成・枠切替・編成実行ボタン・結果表示。
- **メール・外部サービス**: Resend、本番ドメイン、到達性。
- **権限・本番データ**: RLS・実ユーザー・複数ブラウザ。
- **日付・タイムゾーン・運用日**: 実際の「前日 CRON」や本番スケジュール。
- **マッチングの「納得感」**: 強さ・学年の組み合わせの運用判断（unit は実装整合・代表的ケースに限定）。

**整理の仕方:** 自動テストで担保したい不変条件（RPC 戻り値・DB 状態）は integration / unit に寄せ、**上記はチェックリストに残す**と責務が分かれる。

---

## 6. マッチング unit（参照・一段落）

`buildMatchingAssignments` 専用は **5 ファイル・52 テスト**。再現:

```bash
npx vitest run tests/unit/build-matching-assignments --config vitest.config.ts
```

### 6 枠日 / 8 枠日の期待値の考え方（要約）

- **6 枠日:** 午前 3 + 午後 3 active。午後がタイトで **`afternoon_second_round_fill`** 後に **`cross_category_match`** が付き得る。テストでは **第 1 巡相当（`afternoon_second_round_fill` なし）に `cross_category_match` を付けない**期待に留めるケースがある。  
- **8 枠日:** 午前 4 + 午後 4 すべて active。同カで足りる局面では **全日午後で `cross_category_match` なし**を期待するケースがある。  
- **`warning_json`:** 型は **`string[]`**。部分一致は `some((w) => w.startsWith("…"))`、フラグの有無は `toContain("…")`（要素一致）。

詳細アルゴリズムは `docs/spec/implemented-matching-algorithm.md`。

---

## 7. local-integration で何を見るか（現状のファイル）

| ファイル | 見ること |
|----------|----------|
| `cron-lock-route.integration.test.ts` | `GET /api/cron/lock-event-days` の **503 / 401**（Supabase 不要）。 |
| `cron-lock-event-days-db.integration.test.ts` | JOB01 の **CK-003/010/011/012/021**。締切は「予約作成＝締切未来 → 更新で過去」に固定し、`event_date` は `tokyoIsoDateToday` / `addDaysIsoDate` で一意・東京日を担保。`beforeAll` で `matching_runs`→`reservations`→`event_days` の順に掃除。 |
| `cron-run-matching-locked-db.integration.test.ts` | JOB02 の **RM-001/010/011** と、`applyMatchingForEventDayId` 連続呼び出しの **RM-012（already_matched）**。`event_date >= tokyoIsoDateToday` 前提は本番ルートと同一。 |
| `public-reservation-rpc.integration.test.ts` | `create_public_reservation` / `cancel_public_reservation` の戻り値と DB 前提。**RSV-006（昼食合計 > 参加人数）**・**RSV-010（成功）**・**RSV-021（slot_locked）** を含む。 |
| `public-reservation-post-route.integration.test.ts` | **`POST /api/reservations`** の **RSV-022**（UUID 形式不正 422・幽霊 ID 404。404 は `hasSupabaseEnv` 時のみ）。 |
| `reservation-token-patch.integration.test.ts` | **`PATCH /api/reservations/[token]`** の **TK-002**（締切後 409・DB 不変）。 |
| `admin-apply-matching-run.integration.test.ts` | **`admin_apply_matching_run`** の `not_locked` と **locked 後の成功縦割り**。 |
| `admin-undo-matching.integration.test.ts` | **`admin_undo_afternoon_matching` RPC（TC-EX-UN-200）**・`confirmed`→`locked`。 |

**前提:** `vitest.integration.config.ts` のコメントどおり **`supabase db reset` 済みの結合専用 DB**・`supabase start`・プロジェクト直下 **`.env.test`**（`tests/integration/env.test.example` 参照）。

```bash
npm run test:integration
```

---

## 8. その他の unit（マッチング以外）

`vitest.config.ts` 配下の例（52 件には含めない）:

- `tests/unit/event-day-slot-count-policy.test.ts`
- `tests/unit/reservation-deadline-default.test.ts`
- `tests/unit/match-assignment-patch-validation.test.ts`

Staging: `npm run test:staging`（`vitest.staging.config.ts`）。

---

## 9. リリース前の手動確認（推奨実施順・台帳用）

**目的:** 自動テストのあと、**人が同じ順でチェック**すると抜け漏れが減る。`MVP_TestSpec_Source.csv` の **手動のみ / 一部 / 保留かつ MVP前後=必須** と対応づける。

| 順 | 実施内容 | 主な仕様 ID・備考 |
|----|----------|-------------------|
| 1 | **ローカル:** `npm run test:unit` → `npm run test:integration`（結合専用 DB・`.env.test`） | META-CI-001 / META-UNIT-* / META-INT-004・CK・RM・RSV・TK 等 |
| 2 | **ステージング:** `npm run test:staging`（`STAGING_BASE_URL` 等） | API-ED / API-AV / TK-001 / CK-001・DASH 行は Cookie 次第で partial |
| 3 | **権限・管理導線（ブラウザ）** | AL-001〜003 |
| 4 | **公開予約 UI**（バリデーション・正常フロー・二重送信） | RSV-001〜003・RSV-010 の UI 部分・RSV-011 |
| 5 | **管理ダッシュ・API**（staging または手動） | MVP-DASH-400 / 200 |
| 6 | **締切救済・運用 API（必要なら）** | TC-EX-CU-OK |
| 7 | **未自動化だが必須に近い確認** | RSV-022 の **404 分岐**（`.env.test` 未整備時は integration skip）・CK-011 の**実メール**（RESEND 設定時）。MVP-NOTIF-401・TC-EX-UN-401 は staging-smoke で自動可 |
| 8 | **Release_Gate P0**（環境・Cron・本番スモーク等） | P0 行・別シート |

**判断メモ:** 上記は「プロダクトが動くか」の順。**運用独自**（チームマージ MRG-001 等）は MVP 直後でもよい場合は CSV の **MVP前後=任意** に従い後回し可。

---

## 10. MVP 未完了のうち「前に片付ける」／「後でもよい」（CSVと併用）

`MVP_TestSpec_Source.csv` の **台帳状態=保留** と **MVP前後** を正としつつ、次は **運用リスク** での補正（P0 シートがあればそちら優先）。

### リリース前に必須寄り（自動が無くても人で一度は確認）

- **権限・公開体験:** AL-001〜003、RSV-001〜003、RSV-010（画面・sessionStorage）、**P0**。
- **公開 API の信頼性:** staging での API-ED / API-AV、**RSV-022**（422 は常時 integration、404 は Supabase 環境要）。
- **通知ゲート:** **MVP-NOTIF-401**・**TC-EX-UN-401**（staging-smoke）。**CK-011** の実送信確認（RESEND 本番／Preview で最低 1 件）。
- **締切救済:** **TC-EX-CU-OK**（運用で使うなら必須）。

### リリース後でも可（MVP 後に integration や手動を増やす候補）

- **RSV-011**（二重送信・UX）、**RM-013**（JOB02 失敗行の可視化）。
- **Cron 通知・前日最終・JOB03・再送**（TC-EX-CR-*、NF-010、TC-EX-CR-DBF-*、NF-001、TC-EX-NR-200S）。
- **当日運用 API**（CHK-*、TC-EX-WX-*、TC-EX-OP-*）。
- **MRG-001**、**MVP-DASH-200**（データ依存の partial 部分）。

**CSV の読み方:** **台帳状態**＝実施台帳上の進捗。**MVP前後**＝ビジネス上の優先度（**必須**はリリース判断で先に埋める。**任意**は後続スプリント可）。
