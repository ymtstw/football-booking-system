-- 自動編成の巻き戻し時、morning_fixed の審判もクリア（MVP・手入力審判未対応前提）。
-- 再実行で午前審判を組み直せるようにする。

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

  IF v_del_afternoon = 0 AND v_del_morning_fill = 0 THEN
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
    'clearedMorningFixedRefereeCount', v_cleared_morning_fixed_ref
  );
END;
$$;

COMMENT ON FUNCTION public.admin_undo_afternoon_matching(uuid) IS
  'confirmed の開催日で、current run の afternoon_auto と morning_fill を削除し event_days を locked に戻す。morning_fixed 行は残しつつ審判のみ NULL（再編成用）。';
