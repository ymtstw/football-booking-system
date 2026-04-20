-- 大会・サイト一般のお問い合わせ（合宿相談 camp_inquiries とは別テーブル）

CREATE TABLE public.tournament_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  message text NOT NULL,
  source_path text,
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT tournament_inquiries_contact_name_nonempty CHECK (length(trim(contact_name)) > 0),
  CONSTRAINT tournament_inquiries_contact_email_nonempty CHECK (length(trim(contact_email)) > 0),
  CONSTRAINT tournament_inquiries_message_nonempty CHECK (length(trim(message)) > 0),
  CONSTRAINT tournament_inquiries_status_chk CHECK (status IN ('new', 'in_progress', 'done'))
);

COMMENT ON TABLE public.tournament_inquiries IS '大会運営へのお問い合わせ（合宿相談とは別）。';
COMMENT ON COLUMN public.tournament_inquiries.message IS '本文（公開フォームから）。';
COMMENT ON COLUMN public.tournament_inquiries.source_path IS '送信元パス（任意）。';
COMMENT ON COLUMN public.tournament_inquiries.status IS 'new=未対応, in_progress=対応中, done=対応済み。';

CREATE INDEX tournament_inquiries_created_at_desc ON public.tournament_inquiries (created_at DESC);
CREATE INDEX tournament_inquiries_status_idx ON public.tournament_inquiries (status);

CREATE TRIGGER tournament_inquiries_set_updated_at
  BEFORE UPDATE ON public.tournament_inquiries
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.tournament_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tournament_inquiries_admin_select
  ON public.tournament_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

CREATE POLICY tournament_inquiries_admin_update
  ON public.tournament_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

GRANT SELECT, UPDATE ON public.tournament_inquiries TO authenticated;
