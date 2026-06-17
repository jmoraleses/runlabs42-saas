-- Platform storage: Vercel Blob metadata + per-user quota
CREATE TABLE IF NOT EXISTS public.user_storage_usage (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  bytes_used BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_storage_usage_select_own" ON public.user_storage_usage;
CREATE POLICY "user_storage_usage_select_own" ON public.user_storage_usage
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ALTER COLUMN storage_provider SET DEFAULT 'platform';

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_storage_provider_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_storage_provider_check
  CHECK (storage_provider IN ('platform', 'user_supabase'));

CREATE INDEX IF NOT EXISTS project_files_storage_key_idx ON public.project_files (storage_key)
  WHERE storage_key IS NOT NULL;
