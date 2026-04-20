-- 大会お問い合わせ: メール誤記時の連絡用に電話番号を保持

ALTER TABLE public.tournament_inquiries
  ADD COLUMN IF NOT EXISTS contact_phone text;

COMMENT ON COLUMN public.tournament_inquiries.contact_phone IS '連絡用電話番号（公開フォーム）。';
