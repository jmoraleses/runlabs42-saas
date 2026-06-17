-- Persistencia de modelos cargados desde Admin (bypass RLS vía SECURITY DEFINER, como admin_upsert_setting).

CREATE OR REPLACE FUNCTION public.admin_upsert_model_pricing_rows(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row jsonb;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows debe ser un array JSON';
  END IF;

  FOR row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.admin_model_pricing (
      model_id,
      label_key,
      display_name,
      provider,
      vendor,
      category,
      status,
      input_per_m,
      output_per_m,
      per_image,
      per_second_video,
      total_per_m,
      source,
      last_synced_at
    ) VALUES (
      row->>'model_id',
      NULLIF(row->>'label_key', ''),
      NULLIF(row->>'display_name', ''),
      row->>'provider',
      row->>'vendor',
      row->>'category',
      row->>'status',
      NULLIF(row->>'input_per_m', '')::numeric,
      NULLIF(row->>'output_per_m', '')::numeric,
      NULLIF(row->>'per_image', '')::numeric,
      NULLIF(row->>'per_second_video', '')::numeric,
      NULLIF(row->>'total_per_m', '')::numeric,
      COALESCE(NULLIF(row->>'source', ''), 'vertex'),
      COALESCE((row->>'last_synced_at')::timestamptz, now())
    )
    ON CONFLICT (model_id) DO UPDATE SET
      label_key = EXCLUDED.label_key,
      display_name = EXCLUDED.display_name,
      provider = EXCLUDED.provider,
      vendor = EXCLUDED.vendor,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      input_per_m = EXCLUDED.input_per_m,
      output_per_m = EXCLUDED.output_per_m,
      per_image = EXCLUDED.per_image,
      per_second_video = EXCLUDED.per_second_video,
      total_per_m = EXCLUDED.total_per_m,
      source = EXCLUDED.source,
      last_synced_at = EXCLUDED.last_synced_at;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_model_pricing_rows(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_model_pricing_rows(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_model_pricing_rows(jsonb) TO service_role;
