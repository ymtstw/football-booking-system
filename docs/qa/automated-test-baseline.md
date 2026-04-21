# 自動テスト・CI・手動 QA のベースライン（MVP 最小）

**Excel 用の一覧（仕様 ID 単位）:** `docs/qa/MVP_TestSpec_Source.csv`（MVP_Minimum_Run を主に、CI・integration・メタ行・件数サマリを同梱）

**方針:** 広く網羅しない。**毎回の CI は unit のみ**。結合はローカル（またはシークレット整備済み CI）で **`npm run test:integration`**。マッチングの純関数 unit は一段落として扱い、詳細な枠数・警告の考え方は下記「マッチング unit（参照）」へ。

---

## 1. CI で毎回回す対象（最小セット）

| 対象 | コマンド | 前提 | 備考 |
|------|----------|------|------|
| **必須（毎 PR / push）** | `npm run test:unit` | Node + `npm ci` のみ | **DB・Supabase 不要**。`vitest.config.ts` → `tests/unit/**/*.test.ts`（現状 **60 テスト**）。 |
| **含めない（デフォルト）** | `npm run test:integration` | ローカル Supabase + `.env.test` または CI に同等シークレット | RPC・DB 依存。GitHub 既定ではシークレット未設定のことが多いため **ワークフローには載せない**。 |
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
| `public-reservation-rpc.integration.test.ts` | `create_public_reservation` / `cancel_public_reservation` の戻り値と DB 前提。 |
| `admin-apply-matching-run.integration.test.ts` | **`admin_apply_matching_run`** の `not_locked` と **locked 後の成功縦割り**。 |

**前提:** `vitest.integration.config.ts` のコメントどおり `supabase start`・`supabase db reset`・プロジェクト直下 **`.env.test`**（`tests/integration/env.test.example` 参照）。

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
