# 自動編成アルゴリズム（実装仕様）

`POST /api/admin/matching/run` が呼ばれたとき、`buildMatchingAssignments`（`src/domains/matching/build-matching-assignments.ts`）で編成案を組み立て、`admin_apply_matching_run` RPC（マイグレーション `20260421100000`）で DB に一括反映する。

正本の業務仕様: `docs/spec/design-mvp.md` §5-2〜5-6。本書は **コードの挙動** を記す。

---

## 編成の前提条件（プロダクト）

- **枠数（運用）:** 管理画面・API では **午前=午後で 3 または 4 のみ**（3+3 または 4+4）。詳細は `design-mvp.md` §3-2-1、`src/lib/event-days/event-day-slot-count-policy.ts`。  
- **枠数（編成）:** 上記のとおり `event_day_slots` の有効行に従い、編成は **枠数に比例してループ**する（固定本数のハードコードなし）。  
- **前日自動編成**: 締切後の `matching/run` で **可能な限り枠に試合行を付与**する（午前は空枠解消を特に重視。詳細は 2b/2c）。  
- **参加チーム数**: 従来の「3〜6」に **上限は設けない**（8チーム以上も同じロジックで処理。`active` が **2未満**のときだけ `morning_fixed` のみ返して打ち切り）。チーム数と枠数の組み合わせは固定しない。  
- **試合数の平準化**: チーム間で **全日の試合数の max−min が 2 以上開くことは避ける**（多くて **1試合差**まで許容）。総試合数や「枠が余る」ことによる **±1試合程度の差**は許容。  
- **大きいプール**: 固定外プールが **実装閾値（10名）を超える**と、午前 `morning_fill` の全探索は分岐が大きいため **貪欲**に切り替える（辞書式最適は諦め、全日試合数バランスを守る）。

---

## 前提・入力

| 項目 | 内容 |
|------|------|
| 開催日 | `event_days.status` は RPC 側で **`locked`** であること（それ以外は拒否）。 |
| 予約 | **`status = active`** のみ。`teams.representative_grade_year`（1〜6）が入っていれば午後の **学年差**ソフトに使う（欠損は中立扱い）。 |
| 参加数 | **`active` が 2 以上**で午前埋め・午後編成を行う。**2 未満**のときは **`morning_fixed` の複製のみ**返し、全 active を `meta.unfilledMorningReservationIds` / `meta.unfilledAfternoonReservationIds` に入れて終了（エラーにしない）。人数上限は設けない。 |
| 枠 | `event_day_slots` のうち **`is_active !== false`** のみを午前・午後の対象とする。午前・午後の **本数は固定しない**（並びは `slot_code` 順）。新規開催日の既定テンプレは **午前3・午後3**（`src/domains/event-days/default-slots.ts`）。4枠運用は管理 API で **4+4** に拡張する。 |
| 既存 run | **現在 `is_current = true` の run** の `morning_fixed` を読み、新 run に **コピー**する（枠・予約 ID はそのまま）。 |
| 再実行 | 既存 current に **`afternoon_auto` が1件でもある**と RPC は **`already_matched`**（409）。 |
| 取り消し | **`POST /api/admin/matching/undo`**（管理ログインのみ）→ RPC **`admin_undo_afternoon_matching`** で current run の **`afternoon_auto` と `morning_fill` を削除**し、**`morning_fixed` は残したまま審判のみ NULL** にし、**`event_days.status` を `locked` に戻す**（締切直後・自動編成前に近い状態）。その後に再度 `matching/run` 可能。 |

---

## 処理の大まかな順序

1. **午前 `morning_fixed`** … 現在 run からコピー。  
2. **午前 `morning_fill`** … `morning_fixed` の a/b 以外の active を対象に、**全探索または貪欲**で `morning_fill` の集合（ペアと枠）を決める（下記「午前 morning_fill」）。全日試合数の偏り（max−min）が **1 を超えない**枝だけを採用。プールが大きいときは貪欲。  
2b. **午前枠埋めフォールバック** … 全探索の直後、**固定以外の午前枠のうち試合行が無い枠**が残るときのみ、**固定外プール・各チーム午前1試合まで**の範囲で段階1〜2＋必要なら希望枠キー緩和のみ試行する（下記「午前枠埋めフォールバック」）。**午後は触れない**（午後は下記の二段階で別途編成）。  
2c. **午前必須埋め** … 2b の後も **非固定の午前枠に行が無い**とき、**空枠を無くす**ことを最優先し `morning_fill` を追加する。**active 全員**からペアを選び、再出場・既対戦・異カテゴリはスコアで劣後。通常の「午前1試合まで」だけでは埋まらない構成（例: 有効午前4枠・active6）では **午前の再出場** を警告付きで許容する。希望枠キーは可能なら守り、無理なときのみ緩和。  
3. **午後** … **目標出場回数**と可行性をハードにしつつ、枠を時間順に処理。**第1段階**は **午後0本の人のみ** eligible で **全員午後1試合**を優先。**第2段階**は **全日目標まで**追加出場を許可（**午後本数の固定2上限は廃止**；多枠で午後3試合目以降も可）。候補比較は `AfternoonEdgeComposite`（強さ・学年差・重複等）。詳細は下記「午後」。  
4. **審判** … 午前→午後の **全日の試合列** でインデックスを決め、午前・午後の各行に同じルールを適用する。**1試合目**は **2試合目の出場2人**から、**2試合目以降（最終除く）**は **次の試合に出ない** active を第一候補とし、審判回数・出場回数で平準化。`morning_fixed` で既に審判 ID がある行は上書きしない。  
5. **メタ情報** … 午前未ペア・**午後ゼロ**・**全日 target 未達**などの予約 ID と短文 `notes` を `meta` に格納（DB 行には載せない）。  
6. **RPC** … 旧 current を外し、新 `matching_runs` と全 `match_assignments` を INSERT し、`event_days.status` を **`confirmed`** にする。

---

## 午前（§5-2 に近い挙動）

### `morning_fixed`

- 既存 current run の `assignment_type = morning_fixed` かつ `match_phase = morning` を **新 run 用の行に複製**（`warning_json` は配列なら引き継ぎ）。
- **a / b / referee（非NULL）** はいずれも **`reservations.status = active` の ID である必要**がある（RPC 検証と一致）。キャンセル等で active にいない ID が残っている行は **編成入力から除外**し、`meta.notes` に記録する（該当枠は午前補完の対象になり得る）。

### 1枠1チーム（singles 入力の組み立て）

- 午前 `morning_fill` の探索に渡す **`Single`（所在枠・予約 ID）** を次のルールで組み立てる。  
- 各 **午前枠**について、`selected_morning_slot_id` がその枠の `active` 予約を集める。  
- **`morning_fixed` と同一枠**のとき: 固定試合の **a/b 以外**の予約だけを載せる。  
- **固定以外の枠**のとき: **1件以上**なら当該枠の **全員**を載せる。  
- 上記のあと、**まだ載っていない active** のうち **`morning_fixed` の a/b でもない**予約を追加する:  
  - `selected_morning_slot_id` が **有効な午前枠 ID** ならその枠を `slotId` にする。  
  - **NULL または無効 ID** のときは、**非固定の午前枠の先頭**（`slot_code` 順）を `slotId` のフォールバックにする。  

### 午前 morning_fill（固定外・全探索または貪欲）

- **対象プール**: `morning_fixed` の **a / b に含まれない** active 予約 ID のみ（固定は不変）。  
- **希望枠集合**: 少なくとも1件の active が `selected_morning_slot_id` にその ID を持つ **有効な午前枠**の集合（カバー数の計算に使用）。  
- **探索**: プール内の予約を **互いに素なペア**に分割し、各ペアに **`morning_fill` 用の枠 ID** を割り当てる。DFS で候補を列挙し、**辞書式で最良**の全体案を採用する（プールが小さいとき）。各枝で **その時点の全日試合数（午前まで）の max−min が 1 を超えない**ものだけ進む。プールが **閾値より大きい**ときは **貪欲**でペアを積み、同じく max−min≤1 を守る。  
- **ペアごとの候補枠**: まず `morningSlotForPairForSingles` の代表枠（希望より前に置かない）。`morning_fixed` 占有枠には置かない。代表枠が使えない場合は、**非固定の午前枠を時間順**に走査し、二人の希望の遅い方の枠順キー以上のものから順に候補に加える（候補数に上限あり・安定化）。  
- **制約**: 枠は **1試合1枠**（同一 `event_day_slot_id` に複数の午前行を付けない）。午前の **既対戦辺**は `morning_fixed` まで含むグラフ上で判定し、既に隣接するペアは組まない。割当枠は **二人の希望枠順キー以上**であること（希望より前に試合を置かない）。  

**採用案の辞書式優先**

1. **`morning_fill` の本数**（最大）  
2. **希望枠のカバー数**（最大）… `morning_fixed` と `morning_fill` のいずれかの行がその枠 ID に付いている希望枠の数  
3. **異カテゴリの辺の本数**（最小）  
4. **午前既対戦となる辺の本数**（最小・通常0）  
5. **出場バランス**… 確定案の各辺について、既存の `scoreMorningPair`（`morning_fixed` のみを `rows` とした出場数＋辺を逐次足しながらのスコア）の **合計が小さい**方を優先  
6. **タイブレーク**… `(slotId, min(a,b), max(a,b))` 字列のソート連結で安定化  

- 探索後、プール内で **どのペアにも入らなかった**予約は **未ペア**節へ回す（フォールバック後は **午前に1試合も付かない**プール予約のみ）。  
- 実装メモ: `meta.notes` に全探索選定の短文が付くことがある。

### 午前枠埋めフォールバック（空枠優先）

- **起動条件**: 全探索で `morning_fill` を付け終えた時点で、**`morning_fixed` 以外の午前枠**のうち **`match_phase = morning` の行が無い枠**が1つでもあるとき。  
- **目的**: 人数不足で空枠が残る場合、**各チーム午前1試合まで**と**固定外プールのみ**を守ったうえで、可能な限り空枠に `morning_fill` を足す。**全日試合数 max−min≤1** を満たすペアに限る。  
- **手順**: 空枠を **枠コード順**に見て、各段階でペアが取れたら1本追加し、空枠が無くなるか段階を進めるまで繰り返す。  

**段階的緩和（1〜2のみ・常にプール・午前1試合まで）**

| 段階 | 候補予約 | 午前1試合まで | 午前既対戦ペア | 同カテゴリ優先（スコア） |
|------|-----------|---------------|----------------|-------------------------|
| 1 | 固定外プールのみ | 守る | 除外 | スコアに含めない |
| 2 | 〃 | 守る | 可（劣後スコア） | 〃 |

- 段階2のループのあと、まだ空枠が残る場合は **希望枠順キー（希望より前に置かない）制約のみ無視**し、**段階2と同じ**（プール・午前1試合・既対戦はスコアで劣後）で再試行する。  
- **警告**（`warning_json` の例）: `morning_fallback_fill`, `morning_fallback_stage_1` / `morning_fallback_stage_2`, `morning_fallback_relaxed_prefs`, `cross_category_match`, `duplicate_opponent`。  
- `meta.notes` にフォールバック試行の短文が付くことがある。

### 午前必須埋め（空枠ゼロ優先）

- **位置**: 午前枠埋めフォールバック（2b）の **直後**。  
- **目的**: 運用上 **非固定の午前枠に試合行が無い状態を避ける**（4枠運用などで枠数が増えても、可能な限り各行を付与する）。  
- **方針**: `active` 全員からペアを選び、**午前の既出場回数の和**・既対戦・異カテゴリの順でスコアが小さい組を採用。希望枠キーは可能なら守り、候補が無いときのみ緩和。  
- **再出場**: 上記 2b では「各チーム午前1試合まで」に縛るが、それでも空枠が残るときは **必須埋めで再出場を許容**する（`repeat_morning_play` 等の警告）。  
- **試合数バランス**: まず **全日 max−min≤1** を満たすペアのみ選ぶ。満たす組が無いときだけ緩和し、その場合は行に **`match_count_spread_violation`** を付与する。  
- **警告の例**: `mandatory_morning_slot_fill`, `repeat_morning_play`, `cross_category_match`, `duplicate_opponent`, `morning_fallback_relaxed_prefs`, `match_count_spread_violation`。  
- **限界**: `active` が2未満のときはペアを構成できず空枠が残る（`meta.notes` に記録）。

**`scoreMorningPair` の内訳**（上記 5. の合計に使用。小さいほど良い）

| 要素 | 重み | 意味 |
|------|------|------|
| 強さカテゴリ不一致 | +50 | `strong` / `potential` が異なる（近い強さを優先）。 |
| 午前で既に対戦 | +1000 | 同一ペアの二重辺。 |
| 出場回数 | +1×件数 | `morning_fixed` の行のみを数えた **a/b 出場数**の和。 |
| 出場回数の差 | +4×差 | 同日で試合数を揃えやすくする。 |

代表学年の寄与は **午前は `morningFillPlan` 側の `gradeDistSum` 等**で扱い、`scoreMorningPair` 本体には含めない（二重計上回避）。

### 未ペア

- 全探索のあと、プール内で **ペアに入らなかった**予約は **`meta.unfilledMorningReservationIds`** に入れ、`meta.notes` に短文を追加（`unfilled_slot` コードは **行の `warning_json` には付けない**）。

---

## 午後（§5-3 に近い挙動）

### 同日対戦回数

- `Map<予約ID, Map<相手ID, 回数>>` で管理。  
- **午前の全行**を先に加算。  
- **午後の計画**では、**各ペアを確定するたび**に同日対戦回数へ加算する（次の枠の候補選びに直ちに反映）。  
- **レスポンス用の警告計算**の直前に、地図を **午前のみ**にリセットし、午後各行を追加するたびに加算し直す（警告と実データの整合）。

### 目標出場回数（全日）

- 午前で埋まった試合行数 `morningMatchesFilled` と **有効な午後枠本数** `afternoonSlotCount` から **全日の試合行数** `totalMatchRowsForTargets = morningMatchesFilled + afternoonSlotCount` を求める。  
- 各 active 予約について **目標出場回数** `targetCount` を **`totalMatchRowsForTargets × 2` を人数で割った base / base+1**（最大1試合差）で割り当てる（`buildTargetPlayCountMap`）。  
- 各午後枠では、候補辺 `(ra, rb)` が **この1本を足してもどちらも target を超えない**こと、かつ **この枠のあと残る午後枠数**について **不足分をペア列で消化できるか**（`afternoonPairKeepsTargetsAndFeasible` / `deficitSequenceCanFillRemainingMatches`）を **ハード**とする。

### 二段階ループ（枠ごと・eligible の切り替え）

- **有効な午後枠**を **`slot_code` / phase 順（時間順）**に並べ、**未使用枠を順に1本ずつ**処理する。  
- **第1段階（`afternoonPhase = 1`）:** `eligible(id) = afternoonCount(id) < 1` かつ **全日が target 未満**（`totalDayPlay < targetCount`）の予約が **2人以上**いるとき、その `eligible` で `pickBestAfternoonPairForSlot` を呼ぶ。  
- **第2段階（`afternoonPhase = 2`）:** 上記でペアが取れないとき、**`remainingCapPickAfternoon(id, 2, ...) > 0`** な予約が2人以上いれば、同関数を **phase 2** で呼ぶ。  
  - `remainingCapPickAfternoon` は **`min(全日あと何試合まで可か by target, 午後段階による上限)`**。  
  - **phase 2 の「午後本数」上限は固定2本にしない**（`remainingAfternoonSlotCapacity` の phase 2 は実質無制限）。多枠（例: 午後4枠×3チーム）で **午後3試合目以降**が必要になる場合を許し、実効上限は **target との差分**のみ。  
  - **phase 1** は従来どおり **午後0本の人にのみ1本**まで（全員午後1試合を優先）。  
- いずれの段でもペアが **`null`**（候補辺が無い／可行性で全滅）なら **`break`** して打ち切り（残枠は未編成。旧バグは phase2 の午後2本固定上限で多枠時に起き得た）。  
- 採用辺は **`AfternoonEdgeComposite` の辞書式比較**（`firstAfternoonCoverage` → **`strengthMismatch`** → **`gradeYearGap`** → `intraRemainderOk` → `dupEdge` → `prior` → `soft`）。`soft` 内では phase 2 のとき **`secondAfternoonPlaySum`**（午後2本目を付ける側の全日累計の和が小さいほど優先）→ gap → consecutive → spread 等。

**補足（旧記述からの差分）**

- 旧: 「第2段階は `afternoonCount < 2` のみ」。→ **廃止**。第2段階は **target と可行性**で上限が決まる。  
- **同カテゴリ完結**の可否は、辺候補の **`intraRemainderFeasibleAfterAfternoonEdge`**（シミュレート後の残りを同カのみで埋め切れるか）を **ソフト加点**として扱う（ハードの「偶数なら異カ除外」は現行実装では別形を取るため、詳細はソース参照）。

**`buildAfternoonPairPickKey`（`soft` の一部）**

| 順位 | キー | 意味（小さいほど良い） |
|------|------|------------------------|
| 1 | secondAfternoonPlaySum | **phase 2 のみ**有効。午後2本目を付ける端の全日累計の和。 |
| 2 | gapSum | 直前出場からの間隔ペナルティ合算 |
| 3 | consec | 連続出場ペナルティ |
| 4 | spread / countAtMin / globalMax / pairMaxAfter | 全日の偏り平準化 |
| 5 | edge | 安定タイブレーク |

### 午後に試合なし

- 最終的に **`afternoonCount < 1`** の予約を **`meta.unfilledAfternoonReservationIds`** に入れる。  
- **`targetCount` に全日で届かなかった**予約は **`meta.targetPlayShortfallReservationIds`** に入れる。

---

## 審判（§5-4 ＋「全日の試合列」）

設計書 §5-4 は午後に限定しているが、実装では **午前の試合行にも審判を1名付与**する。`morning_fixed` で DB から引き継いだ審判が既にある行は上書きしない。

### 試合列（インデックスの定義）

**午前の試合行を枠の時間順**に並べ、続けて **午後の `planned` を枠の並び順**に並べたものを `dayMatches[0..]` とする（1試合目＝先頭、2試合目＝その次）。

### 午前の審判（枠順のみ参照）

候補は常に **当該枠の出場者（a/b）以外**の active。以下は **午前行のループ内だけ**の優先（午後の審判には使わない）。

| 午前の位置（0始まり） | 第一候補（`preferredIds`） | 備考 |
|----------------------|----------------------------|------|
| **0**（1枠目） | **次の午前枠**の出場2人のうち、当枠に出ていない予約 ID | 該当がいなければ優先集合を空にし、全候補同ティアで審判回数等のみ。 |
| **1**（2枠目） | **直前の午前枠**の出場2人のうち、当枠に出ていない予約 ID | 同上。 |
| **2 以降**（午前3枠目以降・インデックス≥2） | なし（空集合） | 審判回数・出場・連続回避のみ。枠数が4でも同じ（1〜2枠目のみ隣接枠優先）。 |

### 午後・全日列での審判優先ルール

| 対象 | 第一候補（審判に寄せたい人） | 備考 |
|------|------------------------------|------|
| **全日1試合目**（`dayMatches[0]`、通常は午前1枠目） | **2試合目**（`dayMatches[1]`）の出場2人（`a`・`b`） | **午後行**の審判付与で使用。`fromSecondMatchOnly` により非第一候補に +24。午前行は **上表の午前専用ルール**。 |
| **2試合目以降**（最終試合を除く） | **次の試合に出ない** active（当事者でも次の試合の出場者でもない） | 第一候補以外には +10。第一候補が空なら全員同ティアで審判回数のみ。 |
| **最終試合** | 当事者以外の active 全員（次の試合がないため） | 上と同様、第一候補集合が実質「全候補」。 |

### 候補スコア（小さいほど良い）

上記の **ティア（0 / +10 / +24）** に加え、

| 要素 | 重み |
|------|------|
| 既に審判に選ばれた回数（`rows` 上） | +10×回数 |
| `rows` 上の **選手としての**出場回数（a/b） | +2×回数 |
| **時間順で直前の試合**と同じ予約が審判になる場合 | +40（連続審判の回避。他候補がいなければ審判回数差で上書きされ得る） |

- **誰もいなければ** `referee_reservation_id = null` とし、`referee_unassigned` を `warning_json` に付与。

**注意（未実装）**

- 同一時刻に「審判として指名された予約が、別の試合に選手として出ている」といった **物理制約**は見ていない（MVP）。

---

## 警告コード（`warning_json`）

| コード | タイミング |
|--------|------------|
| `cross_category_match` | 午前/午後でカテゴリが異なるペア。 |
| `duplicate_opponent` | 午前で対戦済み、または **同日で既に1回以上対戦**している相手と再度対戦。 |
| `afternoon_second_round_fill` | 午後 **第2段階**（`afternoonPhase = 2`）で割り当てた試合（目標未到達の追加出場。2試合目に限らない）。 |
| `morning_fallback_fill` / `morning_fallback_stage_1` / `morning_fallback_stage_2` | 午前枠埋めフォールバック（2b）。 |
| `morning_fallback_relaxed_prefs` | 希望枠順キー制約を緩めたとき（2b または 2c）。 |
| `mandatory_morning_slot_fill` | 午前必須埋め（2c）。空枠解消のため通常より制約を広げたペア。 |
| `repeat_morning_play` | 同一予約が午前に複数試合に出るとき（主に 2c）。 |
| `match_count_spread_violation` | 全日試合数の max−min≤1 を守れずに割り当てたとき（主に 2c の最終緩和）。 |
| `referee_unassigned` | 審判候補がいない。 |
| `afternoon_pair_pick_tier_A`〜`_D` | 午後辺の採用ティア（A=同カ非重複 … D=異カ重複。`afternoonEdgePickTierLabel`）。 |

`double_assigned_reservation` 等は **現状付与しない**（二重割当防止は組み立てロジックで回避）。

---

## API レスポンスの `meta`

`POST /api/admin/matching/run` 成功時 JSON の `meta`:

| フィールド | 型 | 意味 |
|------------|-----|------|
| `unfilledMorningReservationIds` | `string[]` | 午前の固定外プールで **ペアに入らなかった** active 予約 ID。 |
| `unfilledAfternoonReservationIds` | `string[]` | 午後1試合も付かなかった予約 ID。 |
| `targetPlayShortfallReservationIds` | `string[]` | 編成後も **全日の `targetCount` に届かなかった**予約 ID。 |
| `notes` | `string[]` | 人間向け短文（0枠スキップ理由など）。 |

---

## 堅牢性

- **`buildMatchingAssignments`（export）** は内部の `computeBuildMatchingAssignments` を **try/catch** で包む。予期せぬ例外時は **`morning_fixed` の複製のみ**を返し、全 active を `meta` の未割当に入れ、`notes` に短文を付与する（API を 500 にしない方針）。

---

## 運用上の既知の限界

- **再実行**: `afternoon_auto` 付き current があると RPC が拒否。手戻りは DB または将来の「再編成」APIが必要。  
- **`confirmed` 後の取り消し**: 本 API では行わない（強制編集は別途 §5-7）。  
- **審判の現実制約**: 上記どおり。  
- **設計書の文言との差**: 割当回数の厳密な定義・`unfilled_slot` の行単位付与などは **将来の拡張**とする。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `src/domains/matching/build-matching-assignments.ts` | 編成案＋`meta` の生成。 |
| `src/app/api/admin/matching/run/route.ts` | 認証・読込・RPC 呼び出し・`meta` 返却。 |
| `supabase/migrations/20260421100000_admin_apply_matching_run.sql` | トランザクション適用。 |
| `src/app/api/admin/matches/route.ts` | 確定後の参照（current run）。`slotsOverview.morningOccupants` は希望枠ごとに予約を出し、試合行が **別枠**のとき `morningMatchNote` で一言注記する。 |
