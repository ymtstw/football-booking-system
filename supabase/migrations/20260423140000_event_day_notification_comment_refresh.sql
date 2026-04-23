-- マッチング案内・前日最終の Cron 時刻変更に合わせ、列コメントのみ更新（スキーマ変更なし）。
-- 正本スケジュールはリポジトリの vercel.json（UTC `0 7` = 案内 16:00 JST、`30 7` = 前日最終 16:30 JST）。
-- 列は 20260431120000_event_day_notification_ops.sql で追加されるため、未追加環境では何もしない。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'event_days'
      AND c.column_name = 'matching_proposal_notice_sent_at'
  ) THEN
    EXECUTE $cmt$
COMMENT ON COLUMN public.event_days.matching_proposal_notice_sent_at IS
  '締切翌日（開催2日前）16:00 JST 想定バッチのマッチング案内メール送信完了時刻。'
$cmt$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'event_days'
      AND c.column_name = 'final_day_before_notice_completed_at'
  ) THEN
    EXECUTE $cmt$
COMMENT ON COLUMN public.event_days.final_day_before_notice_completed_at IS
  '開催前日16:30 JST 想定バッチの最終通知（day_before_final）一括処理を完了した時刻。'
$cmt$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'event_days'
      AND c.column_name = 'weather_day_before_rain_scheduled'
  ) THEN
    EXECUTE $cmt$
COMMENT ON COLUMN public.event_days.weather_day_before_rain_scheduled IS
  'true: 前日一括バッチ（JOB03・16:30頃JST）で雨天中止文面を送る予約（開催確定のまま雨天判断のみ先行登録）。即時送信後は false に戻す。'
$cmt$;
  END IF;
END $$;
