-- meal_orders から駐車台数を削除し、create_public_reservation の引数から p_parking_count を除去する（既存DB向け）。
-- 旧関数が parking_count を参照するため、先に DROP FUNCTION してから列を落とす。

DROP FUNCTION IF EXISTS public.create_public_reservation(
  uuid, uuid, text, text, text, text, text, integer, integer, integer, text, text
);

ALTER TABLE public.meal_orders DROP COLUMN IF EXISTS parking_count;

CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_event_day_id uuid,
  p_selected_morning_slot_id uuid,
  p_team_name text,
  p_strength_category text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_participant_count integer,
  p_meal_count integer,
  p_remarks text,
  p_token_hash text
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
  v_slot_before int;
  v_team_id uuid;
  v_res_id uuid;
  v_partner_id uuid;
  v_mr_id uuid;
  v_strength public.strength_category;
  v_name text := trim(p_team_name);
  v_email text := lower(trim(p_contact_email));
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
  IF p_meal_count IS NULL OR p_meal_count < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'mealCount');
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

  SELECT COUNT(*)::int INTO v_day_count
  FROM public.reservations
  WHERE event_day_id = p_event_day_id AND status = 'active';
  IF v_day_count >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'day_full');
  END IF;

  SELECT COUNT(*)::int INTO v_slot_before
  FROM public.reservations
  WHERE selected_morning_slot_id = p_selected_morning_slot_id AND status = 'active';
  IF v_slot_before >= 2 THEN
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
      team_name, strength_category, contact_name, contact_email, contact_phone, is_active
    ) VALUES (
      v_name, v_strength, trim(p_contact_name), v_email, trim(p_contact_phone), true
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

  INSERT INTO public.meal_orders (reservation_id, meal_count)
  VALUES (v_res_id, p_meal_count);

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

COMMENT ON FUNCTION public.create_public_reservation IS '公開予約作成。service_role / Route Handler からのみ呼ぶ。';

REVOKE ALL ON FUNCTION public.create_public_reservation(
  uuid, uuid, text, text, text, text, text, integer, integer, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_reservation(
  uuid, uuid, text, text, text, text, text, integer, integer, text, text
) TO service_role;
