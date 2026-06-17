-- GitHub OAuth (lectura de repos) independiente del proveedor de login
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS github_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS github_login TEXT,
  ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;
