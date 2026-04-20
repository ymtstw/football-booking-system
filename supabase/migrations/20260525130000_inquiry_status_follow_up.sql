-- お問い合わせ・合宿相談のステータスに「要再対応」を追加（手動設定のみ）

ALTER TABLE public.tournament_inquiries
  DROP CONSTRAINT IF EXISTS tournament_inquiries_status_chk;

ALTER TABLE public.tournament_inquiries
  ADD CONSTRAINT tournament_inquiries_status_chk CHECK (
    status IN ('new', 'in_progress', 'follow_up', 'done')
  );

COMMENT ON COLUMN public.tournament_inquiries.status IS
  'new=未対応, in_progress=対応中, follow_up=要再対応（手動。メールの追加やりとり等）, done=対応済み。';

ALTER TABLE public.camp_inquiries
  DROP CONSTRAINT IF EXISTS camp_inquiries_status_chk;

ALTER TABLE public.camp_inquiries
  ADD CONSTRAINT camp_inquiries_status_chk CHECK (
    status IN ('new', 'in_progress', 'follow_up', 'done')
  );

COMMENT ON COLUMN public.camp_inquiries.status IS
  'new=未対応, in_progress=対応中, follow_up=要再対応（手動。メールの追加やりとり等）, done=対応済み。';
