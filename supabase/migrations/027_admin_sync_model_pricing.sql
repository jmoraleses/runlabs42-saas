-- Sincroniza la tabla de precios/modelos: elimina filas que ya no están en la carga.

CREATE OR REPLACE FUNCTION public.admin_sync_model_pricing_rows(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row jsonb;
  keep_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows debe ser un array JSON';
  END IF;

  FOR row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    keep_ids := array_append(keep_ids, row->>'model_id');
  END LOOP;

  IF array_length(keep_ids, 1) IS NULL THEN
    DELETE FROM public.admin_model_pricing;
  ELSE
    DELETE FROM public.admin_model_pricing
    WHERE NOT (model_id = ANY(keep_ids));
  END IF;

  PERFORM public.admin_upsert_model_pricing_rows(p_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_model_pricing_rows(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_model_pricing_rows(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_model_pricing_rows(jsonb) TO service_role;
