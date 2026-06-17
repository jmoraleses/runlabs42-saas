-- Configuración global del panel admin (dictado, Vertex context cache, créditos, etc.).

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_settings_select_authenticated ON public.admin_settings;
CREATE POLICY admin_settings_select_authenticated
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS admin_settings_insert_authenticated ON public.admin_settings;
CREATE POLICY admin_settings_insert_authenticated
  ON public.admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS admin_settings_update_authenticated ON public.admin_settings;
CREATE POLICY admin_settings_update_authenticated
  ON public.admin_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.admin_upsert_setting(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'p_key requerido';
  END IF;
  IF p_value IS NULL THEN
    RAISE EXCEPTION 'p_value requerido';
  END IF;

  INSERT INTO public.admin_settings (key, value, updated_at)
  VALUES (trim(p_key), p_value, now())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_settings()
RETURNS TABLE (key text, value jsonb, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value, s.updated_at
  FROM public.admin_settings s
  ORDER BY s.key;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_setting(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_setting(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_setting(text, jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_list_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_settings() TO service_role;
