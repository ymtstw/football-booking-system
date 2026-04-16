-- 新運用: マッチング案内・前日最終の送信記録、雨天中止の「前日17:00予約」フラグ

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS matching_proposal_notice_sent_at timestamptz NULL;

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS final_day_before_notice_completed_at timestamptz NULL;

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS weather_day_before_rain_scheduled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.event_days.matching_proposal_notice_sent_at IS
  '締切翌日（開催2日前）16:30 JST のマッチング案内メール送信完了時刻。';

COMMENT ON COLUMN public.event_days.final_day_before_notice_completed_at IS
  '開催前日17:00 JST の最終通知（day_before_final）一括処理を完了した時刻。';

COMMENT ON COLUMN public.event_days.weather_day_before_rain_scheduled IS
  'true: 前日17:00のCronで雨天中止文面を送る（開催確定のまま雨天判断のみ先行登録）。即時送信後は false に戻す。';
