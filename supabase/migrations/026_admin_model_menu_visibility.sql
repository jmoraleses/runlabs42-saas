-- Selección de modelos visibles (Lenguaje / Código / OCR) para admin y chat.

CREATE TABLE IF NOT EXISTS public.admin_model_menu_visibility (
  id TEXT PRIMARY KEY DEFAULT 'default',
  value JSONB NOT NULL DEFAULT '{"language":[],"coding":[],"ocr":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_model_menu_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_model_menu_visibility_select_authenticated ON public.admin_model_menu_visibility;
CREATE POLICY admin_model_menu_visibility_select_authenticated
  ON public.admin_model_menu_visibility
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS admin_model_menu_visibility_insert_authenticated ON public.admin_model_menu_visibility;
CREATE POLICY admin_model_menu_visibility_insert_authenticated
  ON public.admin_model_menu_visibility
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS admin_model_menu_visibility_update_authenticated ON public.admin_model_menu_visibility;
CREATE POLICY admin_model_menu_visibility_update_authenticated
  ON public.admin_model_menu_visibility
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.admin_upsert_model_menu_visibility(p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN
    RAISE EXCEPTION 'p_value debe ser un objeto JSON';
  END IF;

  INSERT INTO public.admin_model_menu_visibility (id, value, updated_at)
  VALUES ('default', p_value, now())
  ON CONFLICT (id) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_model_menu_visibility(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_model_menu_visibility(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_model_menu_visibility(jsonb) TO service_role;
