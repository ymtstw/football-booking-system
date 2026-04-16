-- 運営都合による開催中止（雨天判断とは別系統）

DO $$
BEGIN
  ALTER TYPE public.event_day_status ADD VALUE 'cancelled_operational';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS operational_cancellation_notice text;

COMMENT ON COLUMN public.event_days.operational_cancellation_notice IS
  '運営都合中止時に参加者向けメールへ差し込む文言（管理者が緊急中止画面で入力）。';
