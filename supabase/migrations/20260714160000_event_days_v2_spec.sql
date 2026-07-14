-- V2 仕様: 学年帯 U-*、max_teams、総当たり編成、予約上限、morning_fixed 廃止（V2 RPC）

ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'round_robin';

ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS max_teams integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS min_teams integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS formation_mode text NOT NULL DEFAULT 'round_robin';

ALTER TABLE public.event_days
  DROP CONSTRAINT IF EXISTS event_days_max_teams_check;

ALTER TABLE public.event_days
  ADD CONSTRAINT event_days_max_teams_check
  CHECK (max_teams >= 2 AND max_teams <= 16);

ALTER TABLE public.event_days
  DROP CONSTRAINT IF EXISTS event_days_min_teams_check;

ALTER TABLE public.event_days
  ADD CONSTRAINT event_days_min_teams_check
  CHECK (min_teams >= 2 AND min_teams <= max_teams);

ALTER TABLE public.event_days
  DROP CONSTRAINT IF EXISTS event_days_formation_mode_check;

ALTER TABLE public.event_days
  ADD CONSTRAINT event_days_formation_mode_check
  CHECK (formation_mode IN ('round_robin', 'tournament', 'legacy'));

COMMENT ON COLUMN public.event_days.max_teams IS '1日あたりの予約上限（active 件数）。既定4。';
COMMENT ON COLUMN public.event_days.min_teams IS '最少催行チーム数。既定2。';
COMMENT ON COLUMN public.event_days.formation_mode IS '編成様式: round_robin / tournament / legacy';

-- ---------------------------------------------------------------------------
-- create_public_reservation: U-* 学年帯、max_teams 上限、morning_fixed 作成なし
-- ---------------------------------------------------------------------------

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
  p_representative_grade_year smallint,
  p_public_ref text
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
  v_strength public.strength_category;
  v_name text := trim(p_team_name);
  v_email text := lower(trim(p_contact_email));
  v_lunch_elem jsonb;
  v_arr_len int;
  v_qty int;
  v_mid uuid;
  v_menu public.lunch_menu_items%ROWTYPE;
  v_band text;
  v_max_year int;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'token hash');
  END IF;
  IF p_public_ref IS NULL OR trim(p_public_ref) = '' OR upper(trim(p_public_ref)) NOT LIKE 'RSV-%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'public_ref');
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
      SELECT 1
      FROM (
        SELECT NULLIF(BTRIM((p_lunch_items->(gs.i))->>'menu_item_id'), '') AS mid_key
        FROM generate_series(
          0,
          COALESCE(jsonb_array_length(p_lunch_items), 0) - 1
        ) AS gs(i)
        WHERE (
          CASE
            WHEN jsonb_typeof((p_lunch_items->(gs.i))->'quantity') = 'number'
              AND ((p_lunch_items->(gs.i))->'quantity')::text ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN FLOOR(((p_lunch_items->(gs.i))->'quantity')::numeric)::int
            WHEN jsonb_typeof((p_lunch_items->(gs.i))->'quantity') = 'string'
              THEN COALESCE(NULLIF(BTRIM((p_lunch_items->(gs.i))->>'quantity'), '')::int, 0)
            ELSE 0
          END
        ) > 0
      ) raw
      WHERE raw.mid_key IS NOT NULL
      GROUP BY raw.mid_key
      HAVING COUNT(*) > 1
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

  v_band := trim(ed.grade_band);
  v_max_year := NULL;
  IF v_band ~ '^U-[1-6]$' THEN
    v_max_year := substring(v_band from 'U-([1-6])')::int;
  ELSIF v_band = '1-2' THEN
    v_max_year := 2;
  ELSIF v_band = '3-4' THEN
    v_max_year := 4;
  ELSIF v_band = '5-6' THEN
    v_max_year := 6;
  END IF;

  IF v_max_year IS NOT NULL AND p_representative_grade_year > v_max_year THEN
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

  SELECT COUNT(*)::int INTO v_day_count
  FROM public.reservations
  WHERE event_day_id = p_event_day_id AND status = 'active';
  IF v_day_count >= ed.max_teams THEN
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
    remarks,
    public_ref
  ) VALUES (
    p_event_day_id,
    v_team_id,
    p_selected_morning_slot_id,
    'active',
    p_participant_count,
    trim(p_token_hash),
    NULLIF(trim(p_remarks), ''),
    upper(trim(p_public_ref))
  )
  RETURNING id INTO v_res_id;

  v_arr_len := COALESCE(jsonb_array_length(p_lunch_items), 0);
  FOR v_lunch_idx IN 0 .. v_arr_len - 1 LOOP
    v_lunch_elem := p_lunch_items->v_lunch_idx;
    BEGIN
      IF jsonb_typeof(v_lunch_elem->'quantity') = 'number' THEN
        v_qty := FLOOR((v_lunch_elem->'quantity')::numeric)::int;
      ELSE
        v_qty := COALESCE(NULLIF(BTRIM(v_lunch_elem->>'quantity'), '')::int, 0);
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
      v_mid := (NULLIF(BTRIM(v_lunch_elem->>'menu_item_id'), ''))::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_input', 'message', 'lunch menu id');
    END;

    SELECT lmi.* INTO v_menu
    FROM public.lunch_menu_items lmi
    WHERE lmi.id = v_mid
      AND lmi.is_active IS TRUE
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.event_day_lunch_menu_items edlm
          WHERE edlm.event_day_id = p_event_day_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.event_day_lunch_menu_items edlm
          WHERE edlm.event_day_id = p_event_day_id
            AND edlm.lunch_menu_item_id = lmi.id
        )
      );

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

-- ---------------------------------------------------------------------------
-- admin_apply_matching_run: round_robin 再実行防止、審判=出場チームを許可
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_apply_matching_run(
  p_event_day_id uuid,
  p_assignments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ed public.event_days%ROWTYPE;
  v_new_run_id uuid;
  v_elem jsonb;
  v_i int;
  v_len int;
  v_slot uuid;
  v_ra uuid;
  v_rb uuid;
  v_ref uuid;
  v_phase public.slot_phase;
  v_type public.assignment_type;
  v_warn jsonb;
  v_has_matched boolean;
  v_warn_count int;
BEGIN
  SELECT * INTO v_ed FROM public.event_days WHERE id = p_event_day_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;

  IF v_ed.status IS DISTINCT FROM 'locked'::public.event_day_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_locked',
      'status', v_ed.status::text
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.matching_runs mr
    INNER JOIN public.match_assignments ma ON ma.matching_run_id = mr.id
    WHERE mr.event_day_id = p_event_day_id
      AND mr.is_current = true
      AND ma.assignment_type IN (
        'afternoon_auto'::public.assignment_type,
        'round_robin'::public.assignment_type
      )
  ) INTO v_has_matched;

  IF v_has_matched THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_matched');
  END IF;

  UPDATE public.matching_runs
  SET is_current = false
  WHERE event_day_id = p_event_day_id
    AND is_current = true;

  INSERT INTO public.matching_runs (
    event_day_id,
    status,
    is_current,
    warning_count,
    started_at,
    finished_at
  )
  VALUES (
    p_event_day_id,
    'success',
    true,
    0,
    now(),
    now()
  )
  RETURNING id INTO v_new_run_id;

  v_len := jsonb_array_length(coalesce(p_assignments, '[]'::jsonb));
  IF v_len > 0 THEN
    FOR v_i IN 0 .. v_len - 1
    LOOP
      v_elem := coalesce(p_assignments, '[]'::jsonb) -> v_i;
    v_slot := (v_elem->>'event_day_slot_id')::uuid;
    v_ra := (v_elem->>'reservation_a_id')::uuid;
    v_rb := (v_elem->>'reservation_b_id')::uuid;

    IF v_elem ? 'referee_reservation_id'
       AND v_elem->'referee_reservation_id' IS NOT NULL
       AND jsonb_typeof(v_elem->'referee_reservation_id') = 'string'
       AND btrim(v_elem->>'referee_reservation_id') <> '' THEN
      v_ref := (btrim(v_elem->>'referee_reservation_id'))::uuid;
    ELSE
      v_ref := NULL;
    END IF;

    BEGIN
      v_phase := (btrim(v_elem->>'match_phase'))::public.slot_phase;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid match_phase: %', v_elem->>'match_phase';
    END;

    BEGIN
      v_type := (btrim(v_elem->>'assignment_type'))::public.assignment_type;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid assignment_type: %', v_elem->>'assignment_type';
    END;

    v_warn := v_elem->'warning_json';
    IF v_warn IS NULL OR jsonb_typeof(v_warn) <> 'array' THEN
      v_warn := '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.event_day_slots s
      WHERE s.id = v_slot AND s.event_day_id = p_event_day_id
    ) THEN
      RAISE EXCEPTION 'invalid event_day_slot_id %', v_slot;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = v_ra AND r.event_day_id = p_event_day_id AND r.status = 'active'::public.reservation_status
    ) THEN
      RAISE EXCEPTION 'invalid reservation_a_id %', v_ra;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = v_rb AND r.event_day_id = p_event_day_id AND r.status = 'active'::public.reservation_status
    ) THEN
      RAISE EXCEPTION 'invalid reservation_b_id %', v_rb;
    END IF;

    IF v_ref IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = v_ref AND r.event_day_id = p_event_day_id AND r.status = 'active'::public.reservation_status
    ) THEN
      RAISE EXCEPTION 'invalid referee_reservation_id %', v_ref;
    END IF;

    IF v_ra = v_rb THEN
      RAISE EXCEPTION 'reservation_a_id and reservation_b_id must differ';
    END IF;

    -- V2: 審判は出場チーム（A または B）を許可
    IF v_ref IS NOT NULL AND v_ref <> v_ra AND v_ref <> v_rb THEN
      RAISE EXCEPTION 'referee must be one of the playing teams';
    END IF;

    INSERT INTO public.match_assignments (
      matching_run_id,
      event_day_id,
      event_day_slot_id,
      match_phase,
      assignment_type,
      reservation_a_id,
      reservation_b_id,
      referee_reservation_id,
      status,
      warning_json
    ) VALUES (
      v_new_run_id,
      p_event_day_id,
      v_slot,
      v_phase,
      v_type,
      v_ra,
      v_rb,
      v_ref,
      'scheduled'::public.match_assignment_status,
      v_warn
    );
    END LOOP;
  END IF;

  SELECT COUNT(*)::int INTO v_warn_count
  FROM public.match_assignments ma
  WHERE ma.matching_run_id = v_new_run_id
    AND ma.warning_json IS NOT NULL
    AND jsonb_typeof(ma.warning_json) = 'array'
    AND jsonb_array_length(ma.warning_json) > 0;

  UPDATE public.matching_runs
  SET warning_count = coalesce(v_warn_count, 0)
  WHERE id = v_new_run_id;

  UPDATE public.event_days
  SET status = 'confirmed'::public.event_day_status, updated_at = now()
  WHERE id = p_event_day_id;

  RETURN jsonb_build_object(
    'success', true,
    'matchingRunId', v_new_run_id,
    'assignmentCount', (
      SELECT COUNT(*)::int FROM public.match_assignments ma WHERE ma.matching_run_id = v_new_run_id
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_undo_afternoon_matching: round_robin も巻き戻し対象
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_undo_afternoon_matching(p_event_day_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ed public.event_days%ROWTYPE;
  v_run_id uuid;
  v_del_afternoon int := 0;
  v_del_morning_fill int := 0;
  v_del_round_robin int := 0;
  v_cleared_morning_fixed_ref int := 0;
  v_warn_count int;
BEGIN
  SELECT * INTO v_ed FROM public.event_days WHERE id = p_event_day_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;

  IF v_ed.status IS DISTINCT FROM 'confirmed'::public.event_day_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_confirmed',
      'status', v_ed.status::text
    );
  END IF;

  SELECT mr.id INTO v_run_id
  FROM public.matching_runs mr
  WHERE mr.event_day_id = p_event_day_id
    AND mr.is_current = true
  FOR UPDATE;

  IF v_run_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_current_run');
  END IF;

  DELETE FROM public.match_assignments ma
  WHERE ma.matching_run_id = v_run_id
    AND ma.assignment_type = 'afternoon_auto'::public.assignment_type;
  GET DIAGNOSTICS v_del_afternoon = ROW_COUNT;

  DELETE FROM public.match_assignments ma
  WHERE ma.matching_run_id = v_run_id
    AND ma.assignment_type = 'morning_fill'::public.assignment_type;
  GET DIAGNOSTICS v_del_morning_fill = ROW_COUNT;

  DELETE FROM public.match_assignments ma
  WHERE ma.matching_run_id = v_run_id
    AND ma.assignment_type = 'round_robin'::public.assignment_type;
  GET DIAGNOSTICS v_del_round_robin = ROW_COUNT;

  IF v_del_afternoon = 0 AND v_del_morning_fill = 0 AND v_del_round_robin = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'nothing_to_undo');
  END IF;

  UPDATE public.match_assignments ma
  SET referee_reservation_id = NULL
  WHERE ma.matching_run_id = v_run_id
    AND ma.match_phase = 'morning'::public.slot_phase
    AND ma.assignment_type = 'morning_fixed'::public.assignment_type
    AND ma.referee_reservation_id IS NOT NULL;
  GET DIAGNOSTICS v_cleared_morning_fixed_ref = ROW_COUNT;

  SELECT COUNT(*)::int INTO v_warn_count
  FROM public.match_assignments ma
  WHERE ma.matching_run_id = v_run_id
    AND ma.warning_json IS NOT NULL
    AND jsonb_typeof(ma.warning_json) = 'array'
    AND jsonb_array_length(ma.warning_json) > 0;

  UPDATE public.matching_runs
  SET warning_count = coalesce(v_warn_count, 0)
  WHERE id = v_run_id;

  UPDATE public.event_days
  SET status = 'locked'::public.event_day_status, updated_at = now()
  WHERE id = p_event_day_id;

  RETURN jsonb_build_object(
    'success', true,
    'deletedAfternoonCount', v_del_afternoon,
    'deletedMorningFillCount', v_del_morning_fill,
    'deletedRoundRobinCount', v_del_round_robin,
    'clearedMorningFixedRefereeCount', v_cleared_morning_fixed_ref
  );
END;
$$;
