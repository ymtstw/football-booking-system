-- MVP 初期スキーマ（design-mvp.md §7 準拠）
-- RLS は 20260407120100_enable_rls.sql で有効化（このファイルの直後に実行される想定）。

-- ---------------------------------------------------------------------------
-- ENUM 相当（PostgreSQL native ENUM）
-- ---------------------------------------------------------------------------

CREATE TYPE public.event_day_status AS ENUM (
  'draft',
  'open',
  'locked',
  'confirmed',
  'cancelled_weather',
  'cancelled_minimum'
);

CREATE TYPE public.reservation_status AS ENUM ('active', 'cancelled');

CREATE TYPE public.matching_run_status AS ENUM ('success', 'failed');

CREATE TYPE public.match_assignment_status AS ENUM ('scheduled', 'cancelled');

CREATE TYPE public.strength_category AS ENUM ('strong', 'potential');

CREATE TYPE public.slot_phase AS ENUM ('morning', 'afternoon');

CREATE TYPE public.assignment_type AS ENUM (
  'morning_fixed',
  'morning_fill',
  'afternoon_auto'
);

-- ---------------------------------------------------------------------------
-- updated_at トリガ
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  normalized_team_name text,
  strength_category public.strength_category NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teams_team_name_contact_email_idx
  ON public.teams (team_name, contact_email);

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_days
-- ---------------------------------------------------------------------------

CREATE TABLE public.event_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  grade_band text NOT NULL,
  status public.event_day_status NOT NULL DEFAULT 'draft',
  reservation_deadline_at timestamptz NOT NULL,
  weather_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_days_event_date_unique UNIQUE (event_date)
);

CREATE TRIGGER event_days_set_updated_at
  BEFORE UPDATE ON public.event_days
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_day_slots
-- ---------------------------------------------------------------------------

CREATE TABLE public.event_day_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE CASCADE,
  slot_code text NOT NULL,
  phase public.slot_phase NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  is_time_changed boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  CONSTRAINT event_day_slots_event_day_slot_code_unique UNIQUE (event_day_id, slot_code),
  CONSTRAINT event_day_slots_time_check CHECK (start_time < end_time)
);

CREATE INDEX event_day_slots_event_day_phase_active_idx
  ON public.event_day_slots (event_day_id, phase, is_active);

CREATE INDEX event_day_slots_event_day_phase_time_changed_idx
  ON public.event_day_slots (event_day_id, phase, is_time_changed);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE RESTRICT,
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE RESTRICT,
  selected_morning_slot_id uuid REFERENCES public.event_day_slots (id) ON DELETE RESTRICT,
  status public.reservation_status NOT NULL DEFAULT 'active',
  participant_count integer NOT NULL,
  reservation_token_hash text NOT NULL,
  remarks text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_participant_count_positive CHECK (participant_count > 0),
  CONSTRAINT reservations_token_hash_unique UNIQUE (reservation_token_hash)
);

CREATE INDEX reservations_event_day_team_idx
  ON public.reservations (event_day_id, team_id);

CREATE INDEX reservations_morning_slot_status_idx
  ON public.reservations (selected_morning_slot_id, status);

CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_orders（reservation 1:1）
-- ---------------------------------------------------------------------------

CREATE TABLE public.meal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations (id) ON DELETE CASCADE,
  meal_count integer NOT NULL,
  parking_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_orders_meal_count_non_negative CHECK (meal_count >= 0)
);

CREATE TRIGGER meal_orders_set_updated_at
  BEFORE UPDATE ON public.meal_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- matching_runs
-- ---------------------------------------------------------------------------

CREATE TABLE public.matching_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE CASCADE,
  status public.matching_run_status NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  warning_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX matching_runs_one_current_per_event_day
  ON public.matching_runs (event_day_id)
  WHERE is_current = true;

-- ---------------------------------------------------------------------------
-- match_assignments
-- ---------------------------------------------------------------------------

CREATE TABLE public.match_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_run_id uuid NOT NULL REFERENCES public.matching_runs (id) ON DELETE CASCADE,
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE CASCADE,
  event_day_slot_id uuid NOT NULL REFERENCES public.event_day_slots (id) ON DELETE RESTRICT,
  match_phase public.slot_phase NOT NULL,
  assignment_type public.assignment_type NOT NULL,
  reservation_a_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE RESTRICT,
  reservation_b_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE RESTRICT,
  referee_reservation_id uuid REFERENCES public.reservations (id) ON DELETE SET NULL,
  status public.match_assignment_status NOT NULL DEFAULT 'scheduled',
  warning_json jsonb,
  manual_override boolean NOT NULL DEFAULT false,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_assignments_distinct_reservations CHECK (reservation_a_id <> reservation_b_id)
);

CREATE TRIGGER match_assignments_set_updated_at
  BEFORE UPDATE ON public.match_assignments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- weather_decisions（go / cancel 履歴）
-- ---------------------------------------------------------------------------

CREATE TABLE public.weather_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('go', 'cancel')),
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid REFERENCES public.event_days (id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations (id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  template_key text,
  payload_summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- reservation_events（監査）
-- ---------------------------------------------------------------------------

CREATE TABLE public.reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES public.event_days (id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- settings（key-value）
-- ---------------------------------------------------------------------------

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- slot_change_logs
-- ---------------------------------------------------------------------------

CREATE TABLE public.slot_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_slot_id uuid NOT NULL REFERENCES public.event_day_slots (id) ON DELETE CASCADE,
  before_json jsonb NOT NULL,
  after_json jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

-- ---------------------------------------------------------------------------
-- match_adjustment_logs
-- ---------------------------------------------------------------------------

CREATE TABLE public.match_adjustment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_assignment_id uuid NOT NULL REFERENCES public.match_assignments (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE INDEX match_adjustment_logs_assignment_changed_at_idx
  ON public.match_adjustment_logs (match_assignment_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- コメント（設計書との対応メモ）
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.teams IS 'チーム属性・代表者。公開予約時に自動作成/再利用';
COMMENT ON TABLE public.event_days IS '開催日・締切・業務状態。weather_status は天候判断用';
COMMENT ON TABLE public.event_day_slots IS '開催日ごとの時間枠。is_active=false で公開・編成から除外';
COMMENT ON TABLE public.reservations IS '参加予約。token 平文は保存しない（ハッシュのみ）';
COMMENT ON TABLE public.matching_runs IS '補完・編成ジョブ単位。is_current 一意は partial unique で担保';
COMMENT ON TABLE public.match_assignments IS '確定試合。morning_fixed / morning_fill / afternoon_auto';
