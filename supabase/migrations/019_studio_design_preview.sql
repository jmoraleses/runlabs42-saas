-- Studio: fase diseño + despliegues preview Vercel
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS design_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS design_phase TEXT NOT NULL DEFAULT 'design'
    CHECK (design_phase IN ('design', 'code'));

CREATE TABLE IF NOT EXISTS public.project_preview_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  files_hash TEXT NOT NULL,
  vercel_deployment_id TEXT NOT NULL,
  vercel_project_id TEXT,
  preview_url TEXT,
  status TEXT NOT NULL DEFAULT 'building'
    CHECK (status IN ('building', 'ready', 'error', 'cancelled')),
  build_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, files_hash)
);

CREATE INDEX IF NOT EXISTS project_preview_deployments_project_idx
  ON public.project_preview_deployments (project_id, created_at DESC);

ALTER TABLE public.project_preview_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_preview_deployments_owner ON public.project_preview_deployments;
CREATE POLICY project_preview_deployments_owner ON public.project_preview_deployments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_preview_deployments.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_preview_deployments.project_id
        AND p.user_id = auth.uid()
    )
  );
