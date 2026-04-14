-- 締切後の編成結果を 1 トランザクションで適用する（Phase 2・POST /api/admin/matching/run から RPC 呼び出し）
-- 前提: event_days.status = locked。既存 current run に afternoon_auto がある場合は拒否（再実行は別タスク）。

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
  v_has_afternoon boolean;
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
      AND ma.assignment_type = 'afternoon_auto'::public.assignment_type
  ) INTO v_has_afternoon;

  IF v_has_afternoon THEN
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

    IF v_ref IS NOT NULL AND (v_ref = v_ra OR v_ref = v_rb) THEN
      RAISE EXCEPTION 'referee must differ from both sides';
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

REVOKE ALL ON FUNCTION public.admin_apply_matching_run(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_matching_run(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.admin_apply_matching_run(uuid, jsonb) IS
  'locked 開催日に編成行を一括投入。旧 current run を is_current=false にし、新 run を作成して event_days を confirmed にする。';
