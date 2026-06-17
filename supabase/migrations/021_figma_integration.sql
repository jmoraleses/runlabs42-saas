-- Figma OAuth para importación/exportación de diseños
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS figma_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS figma_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS figma_user_id TEXT,
  ADD COLUMN IF NOT EXISTS figma_connected_at TIMESTAMPTZ;
