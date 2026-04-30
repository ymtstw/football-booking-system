-- 合宿相談・大会お問い合わせ: 管理者用対応メモ（公開 API・顧客向けメールに含めない）

ALTER TABLE public.camp_inquiries
  ADD COLUMN IF NOT EXISTS internal_note text;

ALTER TABLE public.tournament_inquiries
  ADD COLUMN IF NOT EXISTS internal_note text;

COMMENT ON COLUMN public.camp_inquiries.internal_note IS '管理者用の対応メモ。顧客向け画面・メールに含めない。';
COMMENT ON COLUMN public.tournament_inquiries.internal_note IS '管理者用の対応メモ。顧客向け画面・メールに含めない。';
