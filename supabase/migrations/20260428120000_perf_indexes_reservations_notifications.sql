-- 管理ダッシュ・予約一覧・公開 availability で多用する
-- reservations: event_day_id + status + created_at（一覧の並び）
-- notifications: event_day_id + status（failed 件数カウント）

CREATE INDEX IF NOT EXISTS reservations_event_day_status_created_at_idx
  ON public.reservations (event_day_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_event_day_status_idx
  ON public.notifications (event_day_id, status);
