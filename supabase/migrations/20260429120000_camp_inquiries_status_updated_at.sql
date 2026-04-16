-- 合宿相談: 対応状況と updated_at（管理画面の手動ステータス更新用）

ALTER TABLE public.camp_inquiries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.camp_inquiries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

ALTER TABLE public.camp_inquiries DROP CONSTRAINT IF EXISTS camp_inquiries_status_chk;

ALTER TABLE public.camp_inquiries
  ADD CONSTRAINT camp_inquiries_status_chk CHECK (status IN ('new', 'in_progress', 'done'));

COMMENT ON COLUMN public.camp_inquiries.updated_at IS '最終更新日時（ステータス変更などで更新）。';
COMMENT ON COLUMN public.camp_inquiries.status IS 'new=未対応, in_progress=対応中, done=対応済み（管理画面で手動更新）。';

CREATE INDEX IF NOT EXISTS camp_inquiries_status_idx ON public.camp_inquiries (status);

DROP TRIGGER IF EXISTS camp_inquiries_set_updated_at ON public.camp_inquiries;

CREATE TRIGGER camp_inquiries_set_updated_at
  BEFORE UPDATE ON public.camp_inquiries
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS camp_inquiries_admin_update ON public.camp_inquiries;

CREATE POLICY camp_inquiries_admin_update
  ON public.camp_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

GRANT UPDATE ON public.camp_inquiries TO authenticated;
