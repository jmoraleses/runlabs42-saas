-- Tabla materializada de precios/modelos cargados desde Admin > Modelos IA

CREATE TABLE IF NOT EXISTS public.admin_model_pricing (
  model_id TEXT PRIMARY KEY,
  label_key TEXT,
  display_name TEXT,
  provider TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  input_per_m NUMERIC,
  output_per_m NUMERIC,
  per_image NUMERIC,
  per_second_video NUMERIC,
  total_per_m NUMERIC,
  source TEXT NOT NULL DEFAULT 'vertex',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_model_pricing_vendor
  ON public.admin_model_pricing (vendor);

CREATE INDEX IF NOT EXISTS idx_admin_model_pricing_category
  ON public.admin_model_pricing (category);
