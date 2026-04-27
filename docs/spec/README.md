# 仕様ドキュメント（実装正本）

このディレクトリは **リポジトリ内のコード・マイグレーションと整合した仕様** を置く。過去の「着工前設計」と乖離した場合は **ここを更新して正本にする**。

## 読み順（推奨）

| 順 | ファイル | 内容 |
|----|----------|------|
| 1 | [implemented-system-overview.md](./implemented-system-overview.md) | 技術スタック・認証・Cron・ルート構成・参照マップ |
| 2 | [mvp-product-intent.md](./mvp-product-intent.md) | MVP の目的・スコープ（短い製品意図） |
| 3 | [implemented-behavior-catalog.md](./implemented-behavior-catalog.md) | **テスト仕様を細かく書ける粒度**の挙動カタログ（API・画面・Cron・状態） |
| 4 | [implemented-matching-algorithm.md](./implemented-matching-algorithm.md) | 自動編成のコード準拠の詳細 |

## 正本の優先順位

1. **DB:** `supabase/migrations/*.sql`（スキーマ・RPC・RLS・CHECK）
2. **サーバ実装:** `src/app/api/**`、`src/lib/**`、`src/domains/**`
3. **本ディレクトリの Markdown**（上記と矛盾する場合は **コードまたはマイグレーションを正**とし、文書を追随する）

## 運用・セットアップ

Cron の叩き方・本番チェックリスト等は `docs/ops/`、`docs/setup-*.md` を参照。業務フローの手順書は `docs/ops/mvp-day-before-runbook.md` 等。編成の手動保存 API の方針は `docs/ops/admin-match-batch-patch-policy.md`。
