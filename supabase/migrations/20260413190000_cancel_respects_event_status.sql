-- 開催日が open でないときは公開取消を拒否（締切ロック後の整合）。

CREATE OR REPLACE FUNCTION public.cancel_public_reservation(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res_id uuid;
  v_event_day_id uuid;
  v_status public.reservation_status;
  v_deadline timestamptz;
  v_event_status public.event_day_status;
BEGIN
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT r.id, r.event_day_id, r.status
  INTO v_res_id, v_event_day_id, v_status
  FROM public.reservations r
  WHERE r.reservation_token_hash = trim(p_token_hash)
  FOR UPDATE;

  IF v_res_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT ed.reservation_deadline_at, ed.status
  INTO v_deadline, v_event_status
  FROM public.event_days ed
  WHERE ed.id = v_event_day_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_status = 'cancelled'::public.reservation_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'reservationId', v_res_id,
      'alreadyCancelled', true
    );
  END IF;

  IF v_event_status IS DISTINCT FROM 'open'::public.event_day_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_open');
  END IF;

  IF now() >= v_deadline THEN
    RETURN jsonb_build_object('success', false, 'error', 'deadline_passed');
  END IF;

  UPDATE public.reservations
  SET status = 'cancelled'::public.reservation_status
  WHERE id = v_res_id;

  UPDATE public.match_assignments ma
  SET status = 'cancelled'::public.match_assignment_status
  WHERE ma.assignment_type = 'morning_fixed'::public.assignment_type
    AND ma.status = 'scheduled'::public.match_assignment_status
    AND (ma.reservation_a_id = v_res_id OR ma.reservation_b_id = v_res_id);

  INSERT INTO public.reservation_events (event_day_id, reservation_id, action, metadata)
  VALUES (v_event_day_id, v_res_id, 'cancelled', '{}'::jsonb);

  RETURN jsonb_build_object(
    'success', true,
    'reservationId', v_res_id
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_public_reservation IS '公開予約取消。open かつ締切前のみ。service_role / Route Handler からのみ呼ぶ。';
