-- Ejecutar en el proyecto Supabase DE CADA USUARIO (SQL Editor).
-- Permite que Runlabs42 guarde y recupere archivos en su cuenta.

CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  language TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS project_files_project_id_idx ON public.project_files (project_id);

-- Runlabs42 accede con service_role desde el servidor (bypass RLS). Sin políticas para anon.
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
