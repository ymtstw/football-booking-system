-- 合宿・宿泊の相談（予約確定ではない）。answers は TypeScript のレジストリと schema_version で解釈。

CREATE TABLE public.camp_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  schema_version text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_path text,
  CONSTRAINT camp_inquiries_schema_version_nonempty CHECK (length(trim(schema_version)) > 0),
  CONSTRAINT camp_inquiries_answers_object CHECK (jsonb_typeof(answers) = 'object')
);

COMMENT ON TABLE public.camp_inquiries IS '合宿相談（問い合わせ）。即時確定しない。answers のキーは camp-inquiry-field-registry の id と対応。';
COMMENT ON COLUMN public.camp_inquiries.schema_version IS 'フィールド定義の世代（例: v1）。変更時にコード側レジストリと揃える。';
COMMENT ON COLUMN public.camp_inquiries.answers IS '項目 id → 値（文字列中心）。将来の項目追加・削除に耐えるため JSONB。';
COMMENT ON COLUMN public.camp_inquiries.source_path IS '送信元パス（任意・デバッグ用）。';

CREATE INDEX camp_inquiries_created_at_desc ON public.camp_inquiries (created_at DESC);

ALTER TABLE public.camp_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY camp_inquiries_admin_select
  ON public.camp_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

GRANT SELECT ON public.camp_inquiries TO authenticated;
