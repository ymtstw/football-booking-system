-- メール送信ログ: 最終送信時刻・行の更新時刻（管理画面の再送確認用）

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.notifications
SET updated_at = created_at;

UPDATE public.notifications
SET sent_at = created_at
WHERE status = 'sent' AND sent_at IS NULL;

COMMENT ON COLUMN public.notifications.sent_at IS 'status が sent になった最終時刻（再送成功で上書き）';
COMMENT ON COLUMN public.notifications.updated_at IS '行の最終更新（INSERT 時は created_at に合わせてよい）';

CREATE OR REPLACE FUNCTION public.notifications_set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    NEW.updated_at := COALESCE(NEW.updated_at, now());
    IF NEW.status = 'sent' THEN
      NEW.sent_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    NEW.sent_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_set_timestamps_trg ON public.notifications;
CREATE TRIGGER notifications_set_timestamps_trg
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.notifications_set_timestamps();
