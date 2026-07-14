# 自動編成アルゴリズム V2（総当たり）

`MATCHING_ALGORITHM` 未設定または `v2` のとき、`buildRoundRobinAssignments`（`src/domains/matching/build-round-robin-assignments.ts`）が使われる。

緊急時は `MATCHING_ALGORITHM=legacy` または開催日 `formation_mode=legacy` で旧 `buildMatchingAssignments` に戻せる（`legacy/matching-v1` ブランチ参照）。

## 前提

| 項目 | 内容 |
|------|------|
| 学年帯 | `U-1` 〜 `U-6`（アンダー年生） |
| 枠（標準） | U-2以下: 30分×6・午前のみ / U-3以上: 45分×4 + 昼休憩 + 45分×2 |
| 予約上限 | `event_days.max_teams`（既定 **4**） |
| 最少催行 | `event_days.min_teams`（既定 **2**） |
| 編成様式 | `formation_mode`: `round_robin`（標準）/ `tournament`（未実装）/ `legacy` |
| morning_fixed | **V2 では予約時に作らない** |

## 総当たり

1. 有効枠（`is_active`）を `slot_code` 順に処理
2. まずユニーク対戦を優先。枠が余れば再戦で埋める
3. チームごとの試合数差は **最大1**
4. `assignment_type = round_robin`

## 審判（暫定）

- 各試合の A/B のいずれかを `referee_reservation_id` に設定
- 全日で審判回数の差が小さくなるよう選択

## 予約

- `create_public_reservation`: `FOR UPDATE` 後、`active >= max_teams` なら `day_full`
- 同時申込は先勝ち（トランザクション）
