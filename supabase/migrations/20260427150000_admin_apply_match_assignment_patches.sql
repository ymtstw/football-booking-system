-- 編成手動調整の一括更新（単一トランザクション・入れ替え途中の不整合を避ける）

CREATE OR REPLACE FUNCTION public.admin_apply_match_assignment_patches(
  p_matching_run_id uuid,
  p_override_reason text,
  p_patches jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_override_reason IS NULL OR trim(p_override_reason) = '' THEN
    RAISE EXCEPTION 'override_reason is required';
  END IF;

  IF p_patches IS NULL OR jsonb_typeof(p_patches) <> 'array' OR jsonb_array_length(p_patches) = 0 THEN
    RAISE EXCEPTION 'p_patches must be a non-empty json array';
  END IF;

  UPDATE public.match_assignments AS ma
  SET
    reservation_a_id = (p_elem->>'reservation_a_id')::uuid,
    reservation_b_id = (p_elem->>'reservation_b_id')::uuid,
    referee_reservation_id = CASE
      WHEN NOT (p_elem ? 'referee_reservation_id') THEN ma.referee_reservation_id
      WHEN jsonb_typeof(p_elem->'referee_reservation_id') = 'null' THEN NULL
      WHEN (p_elem->>'referee_reservation_id') = '' THEN NULL
      ELSE (p_elem->>'referee_reservation_id')::uuid
    END,
    event_day_slot_id = (p_elem->>'event_day_slot_id')::uuid,
    manual_override = true,
    override_reason = trim(p_override_reason),
    updated_at = now()
  FROM jsonb_array_elements(p_patches) AS p_elem
  WHERE ma.id = (p_elem->>'assignment_id')::uuid
    AND ma.matching_run_id = p_matching_run_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

COMMENT ON FUNCTION public.admin_apply_match_assignment_patches(uuid, text, jsonb) IS
  'match_assignments の手動一括更新。API 側で検証済みのパッチのみ渡す。';

REVOKE ALL ON FUNCTION public.admin_apply_match_assignment_patches(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_match_assignment_patches(uuid, text, jsonb) TO service_role;
