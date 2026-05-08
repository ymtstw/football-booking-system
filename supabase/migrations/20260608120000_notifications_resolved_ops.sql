-- notifications: 送信結果（status）と運用対応（resolved_*）を分離する

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_note text;

COMMENT ON COLUMN public.notifications.resolved_at IS '運用上の対応完了時刻（failed を未対応として扱う条件に利用）';
COMMENT ON COLUMN public.notifications.resolved_by IS '運用対応者（auth.users.id）。NULL の場合は不明';
COMMENT ON COLUMN public.notifications.resolved_note IS '運用対応メモ（任意）';

-- 参照整合性（存在しないユーザーIDを入れない）。auth が無い環境では無視できるようにする
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_resolved_by_fk
      FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- already exists
  NULL;
END $$;

-- 運用上よく使うフィルタのための部分インデックス
CREATE INDEX IF NOT EXISTS idx_notifications_failed_unresolved
  ON public.notifications (event_day_id, created_at DESC)
  WHERE status = 'failed' AND resolved_at IS NULL;

