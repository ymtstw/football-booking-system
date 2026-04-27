# 試合編成・手動調整（batch-patch）の方針とセキュティ

**対象:** `POST /api/admin/matches/batch-patch` と管理 UI「試合表・編成 → 手動調整」。  
**更新:** 運用方針として UI から試合時刻（枠）変更を外したタイミングで整合を取るためのメモ。

## 運用・製品方針

| 項目 | 方針 |
|------|------|
| **管理 UI（手動調整）** | **対戦チーム・審判のみ**変更。試合が載る時間帯（`event_day_slots`／画面上の「時刻」表示）は **一覧どおり**。編集フォームには時刻セレクトを出さない。 |
| **`eventDaySlotId` と API** | **リクエストボディには引き続き含める（正は現行割当と同一）**。将来、運用だけで別枠へ載せ替えが必要になったときに **UI を戻す／別ツールから叩ける**ように、サーバ側は **削除しない**。 |
| **変更理由** | `overrideReason` は **必須**。保存単位あたり 1 回（すべてのパッチ共通の理由として記録）。 |

「枠だけ後から変えられるなら当面 UI は置かない」という判断でよい。**スキーマや API を無理に狭めない**方が、後から選べる余地が残る。

## API のセキュティ・検証（リリース前確認メモ）

実装ファイル: `src/app/api/admin/matches/batch-patch/route.ts`。

| チェック | 内容 |
|----------|------|
| **認証** | `getAdminUser()`。管理者でなければ **401 Unauthorized**。匿名・一般利用者は叩けない。 |
| **開催日** | `eventDate` は `YYYY-MM-DD` のみ受け付け。該当 `event_days` が無ければ **404**。 |
| **編集可能状態** | `event_days.status` が **`locked` または `confirmed`** のときのみ続行。それ以外は **422**。 |
| **matching_run** | **`is_current = true`** の run が無いときは **404**。 |
| **パッチ本体** | 各要素に `assignmentId` / `reservationAId` / `reservationBId` / `eventDaySlotId`（UUID）と `refereeReservationId`（UUID または null）。形式不正・A=B・審判が A/B と同一は **422**。 |
| **割当の所属** | `assignmentId` はその **matching_run に属する行**のみ。それ以外は **422**。 |
| **編成整合** | **`validateMergedMatchAssignments()`** で、マージ後の割当集合が「枠・フェーズ・予約の状態」と矛盾しないか検証。**失敗時は 422**（メッセージで理由）。ここで **別枠への移動がビジネスルール上許されない組み合わせも弾く**。 |
| **永続化** | RPC `admin_apply_match_assignment_patches` を **単一トランザクション**で実行。更新件数がパッチ件数と一致しないときは **500**。 |
| **監査** | `match_adjustment_logs` へ **`manual_patch`** と変更前後スナップショット。**ログ失敗時は割当更新後に 500**（運用では再読込・手動確認が必要となる旨をレスポンスに記載）。 |

以上より、**管理者セッション必須**かつ **確定済み運用日以降のみ**かつ **サーバ側編成検証済み**であることは確認できる。公開 API（匿名）とは別レイヤで保護されている。

## DB（RPC・マイグレーション）

- **`admin_apply_match_assignment_patches`** は `supabase/migrations/` 配下に定義。**ローカル／Staging／本番** はいずれも **`supabase db push` で同じマイグレーションを適用したプロジェクト同士でスキーマ整合**となる（運用手順は [setup-staging-supabase.md](../setup-staging-supabase.md)、本番も同様に対象 ref を `link` してから `npm run db:push`）。
- UI を変えても **新しいマイグレーションが必須になるとは限らない**（今回の方針メモのみの場合）。**RPC／テーブル追加があるリリース**では、必ず各環境へ push してからアプリをデプロイする。

## 関連コード

| パス | 役割 |
|------|------|
| `src/app/api/admin/matches/batch-patch/route.ts` | Route Handler |
| `src/lib/admin/validate-merged-match-assignments.ts` | マージ後割当の検証 |
| `src/app/admin/(protected)/pre-day-results/pre-day-adjust-client.tsx` | 手動調整 UI（時刻セレクトなし・表示のみ） |
