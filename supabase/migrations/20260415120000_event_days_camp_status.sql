-- 合宿占有はシステム外で台帳管理し、本列は表示・日帰り予約ブロック用（将来 camp_reservations へ拡張可能）

CREATE TYPE public.event_day_camp_status AS ENUM ('none', 'reserved');

ALTER TABLE public.event_days
  ADD COLUMN camp_status public.event_day_camp_status NOT NULL DEFAULT 'none';

COMMENT ON TYPE public.event_day_camp_status IS '開催日の合宿占有。reserved の日は create_public_reservation 不可。';

COMMENT ON COLUMN public.event_days.camp_status IS '合宿等の占有表示。reserved で日帰り予約を拒否。将来 camp_reservations と同期する想定。';
