-- 雨天中止・運営中止の「取り消し」用に、中止直前の event_days.status を保持する

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS status_before_weather_cancel public.event_day_status NULL;

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS status_before_operational_cancel public.event_day_status NULL;

COMMENT ON COLUMN public.event_days.status_before_weather_cancel IS
  '雨天中止にした直前の status（open/locked/confirmed）。取り消し時に復元する。';

COMMENT ON COLUMN public.event_days.status_before_operational_cancel IS
  '運営都合中止にした直前の status。取り消し時に復元する。';
