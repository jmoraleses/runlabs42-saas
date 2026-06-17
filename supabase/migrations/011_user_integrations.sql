-- Runlabs42: cuentas Vercel + Supabase por usuario (BYO infra)
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  supabase_project_ref TEXT,
  supabase_url TEXT,
  supabase_anon_key_enc TEXT,
  supabase_service_role_enc TEXT,
  supabase_connected_at TIMESTAMPTZ,
  vercel_team_id TEXT,
  vercel_access_token_enc TEXT,
  vercel_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_integrations_select_own" ON public.user_integrations;
CREATE POLICY "user_integrations_select_own" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_insert_own" ON public.user_integrations;
CREATE POLICY "user_integrations_insert_own" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_update_own" ON public.user_integrations;
CREATE POLICY "user_integrations_update_own" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_integrations_delete_own" ON public.user_integrations;
CREATE POLICY "user_integrations_delete_own" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'user_supabase'
    CHECK (storage_provider IN ('platform', 'user_supabase')),
  ADD COLUMN IF NOT EXISTS external_supabase_ref TEXT,
  ADD COLUMN IF NOT EXISTS external_vercel_project_id TEXT,
  ADD COLUMN IF NOT EXISTS deployed_url TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_listed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS projects_marketplace_listed_idx ON public.projects (marketplace_listed)
  WHERE marketplace_listed = TRUE;

DROP TRIGGER IF EXISTS user_integrations_set_updated_at ON public.user_integrations;
CREATE TRIGGER user_integrations_set_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
