-- RLS（design-mvp.md §4-2・§10 / docs/progress.md 1-2）
--
-- 方針:
--   - anon: ポリシーなし → テーブルへの直接アクセスは不可（公開は Route Handler 等＋service role 推奨）。
--   - authenticated: public.app_admins に登録されたユーザーのみ、業務テーブルへ CRUD 可（将来の管理 UI が
--     createServerClient(anon + セッション) で読む場合用）。
--   - service_role: Supabase 既定どおり RLS をバイパス（サーバー専用キーでの更新経路）。
--
-- 初回管理者: Supabase SQL Editor で auth.users の id を確認し、例:
--   INSERT INTO public.app_admins (user_id) VALUES ('<uuid>');

-- ---------------------------------------------------------------------------
-- 管理者登録（Auth の user id のみ保持）
-- ---------------------------------------------------------------------------

CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_admins IS 'Supabase Auth の user_id。ここに含まれるユーザーのみ authenticated 経由で業務テーブルにアクセス可';

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- 自分が管理者かどうかの判定に必要（他行は見えない）
CREATE POLICY app_admins_select_own
  ON public.app_admins
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- INSERT/UPDATE/DELETE は service role（SQL Editor 等）のみ想定

-- ---------------------------------------------------------------------------
-- 管理者判定
--
-- SECURITY INVOKER のままだと、app_admins への SELECT が RLS で潰れた場合
-- （select_own ポリシー欠如・誤変更など）に、登録済み管理者でも false になり得る。
-- SECURITY DEFINER にし、search_path を固定して、関数内の app_admins 参照は
-- オーナー権限（RLS バイパス）とする。auth.uid() は呼び出しセッションのまま。
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins a
    WHERE a.user_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION public.is_app_admin() IS 'authenticated かつ app_admins に自分の user_id があるとき true（DEFINER で RLS に依存しない）';

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 業務テーブル: RLS 有効 + 管理者のみ authenticated からアクセス
-- ---------------------------------------------------------------------------

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_day_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_adjustment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_admin_all
  ON public.teams
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY event_days_admin_all
  ON public.event_days
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY event_day_slots_admin_all
  ON public.event_day_slots
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY reservations_admin_all
  ON public.reservations
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY meal_orders_admin_all
  ON public.meal_orders
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY matching_runs_admin_all
  ON public.matching_runs
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY match_assignments_admin_all
  ON public.match_assignments
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY weather_decisions_admin_all
  ON public.weather_decisions
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY notifications_admin_all
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY reservation_events_admin_all
  ON public.reservation_events
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY settings_admin_all
  ON public.settings
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY slot_change_logs_admin_all
  ON public.slot_change_logs
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY match_adjustment_logs_admin_all
  ON public.match_adjustment_logs
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
