-- =============================================================================
-- 警告: public スキーマの「すべてのテーブル」の行を削除する（スキーマ・マイグレーション履歴は残す）
-- =============================================================================
-- 想定用途: Staging などで業務データだけを空にしたいとき。
-- 実行前に必ず:
--   1) Supabase Dashboard で「対象プロジェクトが Staging か」を確認する（本番で実行しない）
--   2) 必要なら Dashboard のバックアップ / ダンプを取る
--
-- 含まれるもの:
--   - public.* の全テーブル（app_admins を含む → 管理者行も消える）
--   - 各テーブルの SERIAL/IDENTITY の連番をリセット（RESTART IDENTITY）
--
-- 含まれないもの（別操作が必要）:
--   - auth.users 等の Auth ユーザー（ログインアカウントは残る。完全に消したい場合は Dashboard の
--     Authentication または auth スキーマ向けの削除を別途行う）
--   - storage.objects（アップロードファイルがあれば Storage から別途削除）
--   - supabase_migrations.*（マイグレーション履歴。通常は触らない）
--
-- 実行: SQL Editor に貼り付け → 1 回実行（必要なら外側で BEGIN/COMMIT を付ける）
-- CLI: `supabase db query --local -f docs/ops/supabase-truncate-all-public-data.sql`（単文のため BEGIN/COMMIT は付けない）
-- =============================================================================

DO $$
DECLARE
  tbls text;
BEGIN
  SELECT string_agg(
           format('%I.%I', schemaname, tablename),
           ', ' ORDER BY tablename
         )
    INTO tbls
    FROM pg_tables
    WHERE schemaname = 'public';

  IF tbls IS NULL OR tbls = '' THEN
    RAISE NOTICE 'public にテーブルがありません';
    RETURN;
  END IF;

  EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE';
  RAISE NOTICE 'TRUNCATE 完了: %', tbls;
END $$;

-- =============================================================================
-- 実行後のメモ
-- =============================================================================
-- ・app_admins が空になったら、管理者は再度 SQL で登録する必要がある:
--     INSERT INTO public.app_admins (user_id) VALUES ('<auth.users の uuid>');
-- ・Auth のユーザーを残しているので、同じメールでログインは可能（ただし業務データは空）
-- =============================================================================
