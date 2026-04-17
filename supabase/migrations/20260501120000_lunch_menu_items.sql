-- 昼食: メニューマスタ + 予約時スナップショット明細。meal_orders を廃止し create_public_reservation の引数を JSON 化。

-- ---------------------------------------------------------------------------
-- lunch_menu_items
-- ---------------------------------------------------------------------------

CREATE TABLE public.lunch_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_tax_included integer NOT NULL CHECK (price_tax_included > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lunch_menu_items_active_sort_idx
  ON public.lunch_menu_items (is_active, sort_order, id);

CREATE TRIGGER lunch_menu_items_set_updated_at
  BEFORE UPDATE ON public.lunch_menu_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

COMMENT ON TABLE public.lunch_menu_items IS '昼食メニュー（税込単価）。公開予約は is_active のみ選択可。';

-- 初期データ（カレー1種）
INSERT INTO public.lunch_menu_items (
  name,
  description,
  price_tax_included,
  is_active,
  sort_order
) VALUES (
  'カレーライス',
  '日替わりスパイスカレー（ライス付き）',
  600,
  true,
  10
);

-- ---------------------------------------------------------------------------
-- reservation_lunch_items（予約時点の単価・名称を固定）
-- ---------------------------------------------------------------------------

CREATE TABLE public.reservation_lunch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.lunch_menu_items (id) ON DELETE SET NULL,
  item_name_snapshot text NOT NULL,
  unit_price_snapshot_tax_included integer NOT NULL
    CHECK (unit_price_snapshot_tax_included > 0),
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 500),
  line_total integer NOT NULL CHECK (line_total > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_lunch_items_line_math CHECK (
    line_total = quantity * unit_price_snapshot_tax_included
  )
);

CREATE INDEX reservation_lunch_items_reservation_id_idx
  ON public.reservation_lunch_items (reservation_id);

COMMENT ON TABLE public.reservation_lunch_items IS '予約ごとの昼食明細。単価・メニュー名は予約時スナップショット。';

-- ---------------------------------------------------------------------------
-- 既存 meal_orders → 明細へ移行（食数0は行なし）
-- ---------------------------------------------------------------------------

INSERT INTO public.reservation_lunch_items (
  reservation_id,
  menu_item_id,
  item_name_snapshot,
  unit_price_snapshot_tax_included,
  quantity,
  line_total
)
SELECT
  mo.reservation_id,
  lm.id,
  lm.name,
  lm.price_tax_included,
  mo.meal_count,
  mo.meal_count * lm.price_tax_included
FROM public.meal_orders mo
CROSS JOIN LATERAL (
  SELECT id, name, price_tax_included
  FROM public.lunch_menu_items
  ORDER BY sort_order ASC, created_at ASC
  LIMIT 1
) lm
WHERE mo.meal_count > 0;

DROP TABLE public.meal_orders;

-- ---------------------------------------------------------------------------
-- create_public_reservation: p_meal_count → p_lunch_items jsonb
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_public_reservation(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  text,
  text,
  smallint
);

CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_event_day_id uuid,
  p_selected_morning_slot_id uuid,
  p_team_name text,
  p_strength_category text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_participant_count integer,
  p_lunch_items jsonb,
  p_remarks text,
  p_token_hash text,
  p_representative_grade_year smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ed public.event_days%ROWTYPE;
  sl public.event_day_slots%ROWTYPE;
  v_day_count int;
  v_day_capacity int;
  v_slot_before int;
  v_team_id uuid;
  v_res_id uuid;
  v_partner_id uuid;
  v_mr_id uuid;
  v_strength public.strength_category;
  v_name text := trim(p_team_name);
  v_email text := lower(trim(p_contact_email));
  elem jsonb;
  v_qty int;
  v_mid uuid;
  v_menu public.lunch_menu_items%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'token hash');
  END IF;
  IF v_name = '' OR p_contact_name IS NULL OR trim(p_contact_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'team/contact');
  END IF;
  IF v_email = '' OR p_contact_phone IS NULL OR trim(p_contact_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'email/phone');
  END IF;
  IF p_participant_count IS NULL OR p_participant_count < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'participantCount');
  END IF;
  IF p_lunch_items IS NULL OR jsonb_typeof(p_lunch_items) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunchItems');
  END IF;
  IF p_representative_grade_year IS NULL
    OR p_representative_grade_year < 1
    OR p_representative_grade_year > 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'representative grade year');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT NULLIF(BTRIM(elem->>'menu_item_id'), '') AS mid_key
      FROM jsonb_array_elements(p_lunch_items) AS t(elem)
      WHERE (
        CASE
          WHEN jsonb_typeof(elem->'quantity') = 'number'
            AND (elem->'quantity')::text ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN FLOOR((elem->'quantity')::numeric)::int
          WHEN jsonb_typeof(elem->'quantity') = 'string'
            THEN COALESCE(NULLIF(BTRIM(elem->>'quantity'), '')::int, 0)
          ELSE 0
        END
      ) > 0
      GROUP BY mid_key
      HAVING COUNT(*) > 1 AND mid_key IS NOT NULL
    ) d
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch_duplicate');
  END IF;

  BEGIN
    v_strength := p_strength_category::public.strength_category;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_strength', 'message', 'strong or potential');
  END;

  SELECT * INTO ed FROM public.event_days WHERE id = p_event_day_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;
  IF ed.status IS DISTINCT FROM 'open'::public.event_day_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_open');
  END IF;
  IF ed.reservation_deadline_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'deadline_passed');
  END IF;

  IF trim(ed.grade_band) = '1-2' AND p_representative_grade_year NOT IN (1, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'grade year vs band');
  END IF;
  IF trim(ed.grade_band) = '3-4' AND p_representative_grade_year NOT IN (3, 4) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'grade year vs band');
  END IF;
  IF trim(ed.grade_band) = '5-6' AND p_representative_grade_year NOT IN (5, 6) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'grade year vs band');
  END IF;

  SELECT * INTO sl
  FROM public.event_day_slots
  WHERE id = p_selected_morning_slot_id AND event_day_id = p_event_day_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_invalid');
  END IF;
  IF sl.phase IS DISTINCT FROM 'morning'::public.slot_phase OR sl.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_invalid');
  END IF;
  IF sl.is_locked IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_locked');
  END IF;

  SELECT COALESCE(SUM(COALESCE(capacity, 2)), 0)::int INTO v_day_capacity
  FROM public.event_day_slots
  WHERE event_day_id = p_event_day_id
    AND phase = 'morning'::public.slot_phase
    AND is_active IS TRUE;

  SELECT COUNT(*)::int INTO v_day_count
  FROM public.reservations
  WHERE event_day_id = p_event_day_id AND status = 'active';
  IF v_day_capacity <= 0 OR v_day_count >= v_day_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'day_full');
  END IF;

  SELECT COUNT(*)::int INTO v_slot_before
  FROM public.reservations
  WHERE selected_morning_slot_id = p_selected_morning_slot_id AND status = 'active';
  IF v_slot_before >= COALESCE(sl.capacity, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_full');
  END IF;

  SELECT id INTO v_team_id
  FROM public.teams
  WHERE team_name = v_name AND lower(trim(contact_email)) = v_email AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.teams
    SET
      contact_name = trim(p_contact_name),
      contact_phone = trim(p_contact_phone),
      strength_category = v_strength,
      representative_grade_year = p_representative_grade_year,
      updated_at = now()
    WHERE id = v_team_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.teams
      WHERE team_name = v_name AND lower(trim(contact_email)) = v_email AND is_active = false
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'team_inactive');
    END IF;

    INSERT INTO public.teams (
      team_name,
      strength_category,
      representative_grade_year,
      contact_name,
      contact_email,
      contact_phone,
      is_active
    ) VALUES (
      v_name,
      v_strength,
      p_representative_grade_year,
      trim(p_contact_name),
      v_email,
      trim(p_contact_phone),
      true
    )
    RETURNING id INTO v_team_id;
  END IF;

  INSERT INTO public.reservations (
    event_day_id,
    team_id,
    selected_morning_slot_id,
    status,
    participant_count,
    reservation_token_hash,
    remarks
  ) VALUES (
    p_event_day_id,
    v_team_id,
    p_selected_morning_slot_id,
    'active',
    p_participant_count,
    trim(p_token_hash),
    NULLIF(trim(p_remarks), '')
  )
  RETURNING id INTO v_res_id;

  FOR elem IN SELECT elem FROM jsonb_array_elements(p_lunch_items) AS t(elem)
  LOOP
    BEGIN
      IF jsonb_typeof(elem->'quantity') = 'number' THEN
        v_qty := FLOOR((elem->'quantity')::numeric)::int;
      ELSE
        v_qty := COALESCE(NULLIF(BTRIM(elem->>'quantity'), '')::int, 0);
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch qty');
    END;

    IF v_qty = 0 THEN
      CONTINUE;
    END IF;

    IF v_qty < 0 OR v_qty > 500 THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch qty range');
    END IF;

    BEGIN
      v_mid := (NULLIF(BTRIM(elem->>'menu_item_id'), ''))::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch menu id');
    END;

    SELECT * INTO v_menu
    FROM public.lunch_menu_items
    WHERE id = v_mid AND is_active IS TRUE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch_menu_invalid');
    END IF;

    INSERT INTO public.reservation_lunch_items (
      reservation_id,
      menu_item_id,
      item_name_snapshot,
      unit_price_snapshot_tax_included,
      quantity,
      line_total
    ) VALUES (
      v_res_id,
      v_menu.id,
      v_menu.name,
      v_menu.price_tax_included,
      v_qty,
      v_qty * v_menu.price_tax_included
    );
  END LOOP;

  INSERT INTO public.reservation_events (event_day_id, reservation_id, action, metadata)
  VALUES (
    p_event_day_id,
    v_res_id,
    'created',
    jsonb_build_object('slot_id', p_selected_morning_slot_id)
  );

  IF v_slot_before = 1 THEN
    SELECT id INTO v_partner_id
    FROM public.reservations
    WHERE selected_morning_slot_id = p_selected_morning_slot_id
      AND status = 'active'
      AND id <> v_res_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_partner_id IS NOT NULL THEN
      SELECT id INTO v_mr_id
      FROM public.matching_runs
      WHERE event_day_id = p_event_day_id AND is_current = true
      LIMIT 1;

      IF v_mr_id IS NULL THEN
        INSERT INTO public.matching_runs (event_day_id, status, is_current, warning_count)
        VALUES (p_event_day_id, 'success', true, 0)
        RETURNING id INTO v_mr_id;
      END IF;

      INSERT INTO public.match_assignments (
        matching_run_id,
        event_day_id,
        event_day_slot_id,
        match_phase,
        assignment_type,
        reservation_a_id,
        reservation_b_id,
        status
      ) VALUES (
        v_mr_id,
        p_event_day_id,
        p_selected_morning_slot_id,
        'morning',
        'morning_fixed',
        v_partner_id,
        v_res_id,
        'scheduled'
      );
    END IF;
  END IF;

  INSERT INTO public.notifications (
    event_day_id,
    reservation_id,
    channel,
    status,
    template_key,
    payload_summary
  ) VALUES (
    p_event_day_id,
    v_res_id,
    'email',
    'pending',
    'reservation_created',
    jsonb_build_object('reservation_id', v_res_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'reservationId', v_res_id,
    'teamId', v_team_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_collision');
END;
$$;

COMMENT ON FUNCTION public.create_public_reservation(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  smallint
) IS
'公開予約作成。昼食は p_lunch_items JSON 配列 [{menu_item_id, quantity}]（quantity 0 は無視）。税込単価は明細にスナップショット。';

REVOKE ALL ON FUNCTION public.create_public_reservation(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  smallint
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_reservation(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb,
  text,
  text,
  smallint
) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS（管理者のみ authenticated、service_role はバイパス）
-- ---------------------------------------------------------------------------

ALTER TABLE public.lunch_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_lunch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY lunch_menu_items_admin_all
  ON public.lunch_menu_items
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY reservation_lunch_items_admin_all
  ON public.reservation_lunch_items
  FOR ALL
  TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());
