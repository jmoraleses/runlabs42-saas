-- Lectura de modelos/precios desde Admin sin service_role (SECURITY DEFINER, como upsert).

CREATE OR REPLACE FUNCTION public.admin_list_model_pricing_rows()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'model_id', model_id,
        'label_key', label_key,
        'display_name', display_name,
        'provider', provider,
        'vendor', vendor,
        'category', category,
        'status', status,
        'input_per_m', input_per_m,
        'output_per_m', output_per_m,
        'per_image', per_image,
        'per_second_video', per_second_video,
        'total_per_m', total_per_m,
        'last_synced_at', last_synced_at
      )
      ORDER BY last_synced_at DESC NULLS LAST, model_id
    ),
    '[]'::jsonb
  )
  FROM public.admin_model_pricing;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_model_pricing_rows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_model_pricing_rows() TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_model_pricing_rows() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_model_menu_visibility()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT value
  FROM public.admin_model_menu_visibility
  WHERE id = 'default'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_model_menu_visibility() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_model_menu_visibility() TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_model_menu_visibility() TO service_role;
