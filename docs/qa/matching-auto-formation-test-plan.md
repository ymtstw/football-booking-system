# 試合自動編成（マッチング）ロジック — テスト観点とケース階層

Cron の成功/失敗レスポンスだけでは **`buildMatchingAssignments`（`src/domains/matching/build-matching-assignments.ts`）の組み合わせ爆発**をカバーできない。本ドキュメントは **純粋ロジック（Vitest 単体）** と **将来の local-integration（API/RPC/DB）** の役割分担を整理する。

仕様の根拠: `docs/spec/implemented-matching-algorithm.md`

---

## 1. テスト観点（カテゴリ）

| # | 観点 | 中身（確認すること） |
|---|------|----------------------|
| A | **枠テンプレ** | 6枠運用（午前3+午後3 active）と 8枠運用（4+4）で分岐。`is_active: false` の枠に行が付かないこと。 |
| B | **チーム数と全日目標** | `totalMatchRowsForTargets = 午前に付いた行数 + 午後枠数` に基づく `targetCount`（`buildTargetPlayCountMap`）。全員 `base` または `base`/`base+1` の最大差1。 |
| C | **午前希望の偏り** | `selected_morning_slot_id` の集中・分散・固定枠との関係。`morning_fill` / 枠埋めフォールバック / 必須埋めの発火条件。 |
| D | **午後自動編成** | 枠時間順のペアリング、phase1（午後0本優先）→ phase2、欠損可行性（hard）と `pickTier`（soft）。 |
| E | **同一枠・同一時間帯** | 同一 `event_day_slot_id` に同一 `reservation_*` が二重に載らない（1枠1試合行）。 |
| F | **最低試合・未割当** | 午前未ペア（`unfilledMorningReservationIds`）、午後ゼロ（`unfilledAfternoonReservationIds`）、目標未達（`targetPlayShortfallReservationIds`）。午後で pair が取れず **ループ打ち切り**で後続枠が空く境界。 |
| G | **対戦・審判の偏り** | `duplicate_opponent` / `cross_category_match` 等の警告。審判の連続枠ルール（全日試合列インデックス）。 |
| H | **強さカテゴリ混在** | strong / potential の人数奇偶、同カ優先と異カ許容のバランス。 |
| I | **既編成・再編成** | `currentAssignments` の `morning_fixed` を引き継ぎ、active 外 ID を除外。undo 後に **同一開催日で再実行**したときの冪等性・差分（RPC 層と合わせて local-integration で担保）。 |
| J | **例外・フォールバック** | `buildMatchingAssignments` の try/catch で固定のみ返す経路（本テストでは異常入力を別ケース化）。 |

---

## 2. MVP で最低限必要なケース vs Master で厚く見るケース

### 2.1 MVP 最小（リリース前に必ず自動化したい）

| 観点 | 内容 |
|------|------|
| 6枠・8枠 × 代表チーム数 | 少なくとも **3 / 4 / 5 チーム** で「全 active 枠に行が付く」「target 最大差1」「午後未割当なし」を満たす代表パターンを **Vitest で固定**。 |
| 登録枠の偏り | **1枠に集中** vs **均等分散** の対極を1本ずつ。 |
| 二重割当防止 | 同一枠に同一予約が重複しないことの **機械チェック**（全シナリオ共通アサーション可）。 |
| 既存 fixed | `morning_fixed` が1本ある状態で残りが `morning_fill` + 午後に入る **最小1本**。 |

### 2.2 Master / 回帰で厚く見るケース（RM-011〜013 より細かい粒度）

| 観点 | 内容 |
|------|------|
| チーム数拡張 | **6 / 7 / 8 チーム**、奇数・偶数の境、午前のみ/午後のみの極端構成。 |
| 境界 | 午後で **pair が取れず打ち切り**、目標未達・午後ゼロが meta に載るパターン。 |
| 強さ混在 | strong 奇数、2s2p、異カ強制の有無（既存 `build-matching-assignments-target.test.ts` と合わせて列管理）。 |
| 審判・重複対戦 | 警告フラグの付き方、全日試合列での審判選好。 |
| 再編成 | undo 相当で `morning_fixed` が空→再実行、または fixed の一部キャンセルで **除外メッセージ**が出る流れ（**local-integration + DB** が主戦場）。 |

**RM-011〜013** は「Cron 経由でジョブが叩けた」レベルに留まりやすい。**Master 側**では上表の ID（`docs/qa/matching-test-cases.csv` の `MT-*`）を **実行順・証跡**と紐づけ、Vitest 名と双方向参照すると追跡しやすい。

---

## 3. テストケース一覧

**一覧の正本**: `docs/qa/matching-test-cases.csv`（列: ID, 枠パターン, チーム数, 午前登録パターン, 主観点, MVP, Master厚め, 実装先, 備考）

実装先の値:

- `vitest-unit` … `buildMatchingAssignments` 直接（本リポジトリで追加・拡張）
- `vitest-unit+既存` … `tests/unit/build-matching-assignments-target.test.ts` に既にある観点
- `local-integration` … `applyMatchingForEventDayId` / RPC / undo フロー（別途 `.env.test`）

---

## 4. Vitest 実装対応（ファイル）

| ファイル | 役割 |
|----------|------|
| `tests/unit/build-matching-assignments-target.test.ts` | 目標試合数・異カ・tier 等の **回帰ベース**（既存）。 |
| `tests/unit/build-matching-assignments-scenarios.test.ts` | **6枠/8枠×チーム数×偏り** のシナリオと共通アサーション（新規）。`describe` 名に **MT-* ID** を含め `matching-test-cases.csv` と双方向参照可能。 |
| `tests/unit/build-matching-assignments-afternoon-edge.test.ts` | **午後自動編成**に絞った境界: meta（`unfilledAfternoon` / 午後ゼロノート）、枠整合、`morning_fixed` 再戦の `duplicate_opponent`、異カ警告、幽霊 fixed 除外後の午後。 |
| `tests/unit/build-matching-assignments-edge.test.ts` | 参加2未満・fixed 幽霊・午前偏り・強さ混在など（午後以外も含む汎用境界）。 |

**Vitest で既にカバーしている MT-*（初回実装）**

| ID | 内容 |
|----|------|
| MT-6-302 | 6枠・3チーム・午前偏り |
| MT-6-401 / MT-6-402 | 6枠・4チーム・偏り/分散 |
| MT-6-501 | 6枠・5チーム |
| MT-6-601 | 6枠・6チーム |
| MT-6-F01 | 6枠・`morning_fixed` + fill |
| MT-8-301 | 8枠・3チーム分散 |
| MT-8-501 | 8枠・5チーム偏り |
| MT-8-601 | 8枠・6チーム |
| MT-8-701 | 8枠・7チーム |
| MT-X-001 | 審判が出場者と同一でないこと（代表1本） |

未実装の代表: **MT-6-E01**（午後ループ `break` は可行性・target 制約次第で再現が難しい。多枠×多チームの探索は CI 負荷のため未採用）、**MT-8-302**（同一枠希望3の仕様境界）、**MT-L-***（local-integration 専用）。

補足: **2チーム×午後多枠**では実装が再戦（`duplicate_opponent` 警告付き）で枠を埋め切るため、「途中打ち切り」を誤って期待しないこと。

共通で推奨するアサーション（シナリオごとに可変部分以外を固定化）:

1. **active 枠のみ**: `is_active !== false` の各枠に対し、`assignments` に **ちょうど1行**（morning/afternoon いずれか）が存在する、または仕様上「空枠許容」のケースでは meta とセットで検証。  
2. **二重枠割当なし**: 同一 `event_day_slot_id` の行において `reservation_a_id !== reservation_b_id`。  
3. **全日出場回数**: 対象 `reservation_id` 集合について、`max(出場回数) - min(出場回数) <= 1`。  
4. **meta**: `targetPlayShortfallReservationIds` / `unfilledAfternoonReservationIds` をシナリオ期待と突合。

---

## 5. local-integration に残すもの（マッチング領域）

- **Cron `lock-event-days` → 編成 API** の HTTP 401/503 と **本文のサマリ**（既存 integration の延長）。  
- **`admin_apply_matching_run` RPC** 適用前後の DB 行数・`matching_run` の整合。  
- **undo 後の再編成**（同一 `event_day_id` で2回目の `buildMatchingAssignments` 入力が DB から組み立てられること）。

これらは **本ドキュメントの `MT-*` ID** を Given/When/Then の見出しに引用すると、手動試験・自動試験のトレースが揃う。
