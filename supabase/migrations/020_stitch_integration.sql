-- Google Stitch project linkage
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stitch_project_id TEXT,
  ADD COLUMN IF NOT EXISTS stitch_design_system_id TEXT,
  ADD COLUMN IF NOT EXISTS design_source TEXT NOT NULL DEFAULT 'stitch'
    CHECK (design_source IN ('stitch', 'legacy'));
